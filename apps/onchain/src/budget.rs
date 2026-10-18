extern crate std;

use std::{collections::BTreeMap, fs, path::PathBuf, string::String};

use serde::{Deserialize, Serialize};
use soroban_sdk::{symbol_short, testutils::Address as _, token, vec, Address, BytesN, Env};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub struct BudgetSnapshot {
    pub cpu: u64,
    pub memory: u64,
    pub read_entries: u64,
    pub write_entries: u64,
    pub mem_bytes: u64,
    pub write_bytes: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct BudgetBaseline {
    pub entries: BTreeMap<String, BudgetSnapshot>,
}

fn baseline_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("budget-baseline.json")
}

fn load_baseline() -> BudgetBaseline {
    let path = baseline_path();
    if !path.exists() {
        panic!("missing committed budget baseline at {}", path.display());
    }

    let data = fs::read_to_string(path).expect("read budget baseline");
    if data.trim().is_empty() {
        return BudgetBaseline::default();
    }
    serde_json::from_str(&data).expect("deserialize committed budget baseline")
}

fn write_baseline(baseline: &BudgetBaseline) {
    let path = baseline_path();
    fs::write(
        path,
        serde_json::to_string_pretty(baseline).expect("serialize budget baseline"),
    )
    .expect("write budget baseline");
}

fn threshold_for(value: u64) -> u64 {
    value.saturating_add(value / 5)
}

fn capture_entry_budget<F>(env: &Env, op: F) -> BudgetSnapshot
where
    F: FnOnce(),
{
    op();

    let budget = env.cost_estimate().budget();
    let resources = env.cost_estimate().resources();

    BudgetSnapshot {
        cpu: budget.cpu_instruction_cost(),
        memory: budget.memory_bytes_cost(),
        read_entries: resources.memory_read_entries as u64,
        write_entries: resources.write_entries as u64,
        mem_bytes: resources.mem_bytes as u64,
        write_bytes: resources.write_bytes as u64,
    }
}

fn create_contract_client(env: &Env) -> crate::VaultixEscrowClient<'_> {
    let admin = Address::generate(env);
    let operator = Address::generate(env);
    let arbitrator = Address::generate(env);
    let treasury = Address::generate(env);
    let contract_id = env.register(
        crate::VaultixEscrow,
        (admin, operator, arbitrator, treasury, Some(0i128)),
    );
    crate::VaultixEscrowClient::new(env, &contract_id)
}

fn create_test_token<'a>(
    env: &'a Env,
    admin: &'a Address,
) -> (token::StellarAssetClient<'a>, Address) {
    let token_address = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let token_admin = token::StellarAssetClient::new(env, &token_address);
    (token_admin, token_address)
}

fn measure_create_escrow(env: &Env) -> BudgetSnapshot {
    env.mock_all_auths();
    let client = create_contract_client(env);
    let admin = Address::generate(env);
    let (token_admin, token_address) = create_test_token(env, &admin);
    let _ = token_admin;

    let milestones = vec![
        env,
        crate::Milestone {
            amount: 5000,
            status: crate::MilestoneStatus::Pending,
            description: symbol_short!("Task"),
        },
    ];

    let depositor = Address::generate(env);
    let recipient = Address::generate(env);
    let metadata = BytesN::from_array(env, &[7u8; 32]);

    capture_entry_budget(env, || {
        client.create_escrow(
            &1u64,
            &depositor,
            &recipient,
            &token_address,
            &milestones,
            &100_000_000u64,
            &metadata,
        );
    })
}

fn measure_list_escrows_by_party(env: &Env) -> BudgetSnapshot {
    env.mock_all_auths();
    let client = create_contract_client(env);
    let admin = Address::generate(env);
    let (token_admin, token_address) = create_test_token(env, &admin);
    let _ = token_admin;

    let milestones = vec![
        env,
        crate::Milestone {
            amount: 5000,
            status: crate::MilestoneStatus::Pending,
            description: symbol_short!("Task"),
        },
    ];

    let depositor = Address::generate(env);
    let recipient = Address::generate(env);
    for i in 1..=25u64 {
        client.create_escrow(
            &i,
            &depositor,
            &recipient,
            &token_address,
            &milestones,
            &100_000_000u64,
            &BytesN::from_array(env, &[7u8; 32]),
        );
    }

    capture_entry_budget(env, || {
        let _ =
            client.list_escrows_by_party(&depositor, &symbol_short!("depositor"), &0u32, &10u32);
    })
}

fn assert_entry_budget(name: &str, actual: &BudgetSnapshot, expected: &BudgetSnapshot) {
    for (field, actual_value, expected_value) in [
        ("cpu", actual.cpu, expected.cpu),
        ("memory", actual.memory, expected.memory),
        ("read_entries", actual.read_entries, expected.read_entries),
        (
            "write_entries",
            actual.write_entries,
            expected.write_entries,
        ),
        ("mem_bytes", actual.mem_bytes, expected.mem_bytes),
        ("write_bytes", actual.write_bytes, expected.write_bytes),
    ] {
        let limit = threshold_for(expected_value);
        assert!(
            actual_value <= limit,
            "budget regression for {name}.{field}: actual={actual_value}, baseline={expected_value}, limit={limit}"
        );
    }
}

#[test]
fn contract_budget_baseline_is_committed() {
    let path = baseline_path();
    assert!(
        path.exists(),
        "expected committed baseline at {}",
        path.display()
    );
}

#[test]
fn contract_budget_regression_guard() {
    let baseline = load_baseline();
    let env = Env::default();

    let actual = BTreeMap::from([
        (String::from("create_escrow"), measure_create_escrow(&env)),
        (
            String::from("list_escrows_by_party"),
            measure_list_escrows_by_party(&env),
        ),
    ]);

    if std::env::var_os("UPDATE_BUDGET_BASELINE").is_some() {
        write_baseline(&BudgetBaseline { entries: actual });
        std::println!(
            "updated Soroban budget baseline at {}",
            baseline_path().display()
        );
        return;
    }

    if baseline.entries.is_empty() {
        panic!("budget baseline is empty; run UPDATE_BUDGET_BASELINE=1 cargo test --manifest-path apps/onchain/Cargo.toml budget -- --nocapture to refresh it");
    }

    for (name, snapshot) in &actual {
        let expected = baseline.entries.get(name).unwrap_or_else(|| {
            panic!("missing committed baseline for entrypoint '{name}'");
        });
        assert_entry_budget(name, snapshot, expected);
    }
}
