"use client";

import React, { useState, useEffect } from "react";
import { User, Copy, Check, Bell, Shield, ImagePlus, Save } from "lucide-react";
import { useWallet } from "@/app/contexts/WalletContext";
import ApiKeyManager from "@/components/settings/ApiKeyManager";

// ── Types ──────────────────────────────────────────────────────────────────

interface NotificationPref {
  eventType: string;
  label: string;
  email: boolean;
  inApp: boolean;
}

// ── Section components ─────────────────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-card-foreground">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ── Profile Section ────────────────────────────────────────────────────────

function ProfileSectionInner() {
  const { wallet } = useWallet();
  const [copied, setCopied] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    setDisplayName(window.localStorage.getItem("vaultix_display_name") ?? "");
    setAvatar(window.localStorage.getItem("vaultix_avatar"));
  }, []);

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setProfileError("");
    setProfileSaved(false);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileError("Choose an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileError("Avatar images must be 2 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatar(reader.result);
        setProfileSaved(false);
      }
    };
    reader.onerror = () => setProfileError("Could not read the selected image.");
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = () => {
    try {
      window.localStorage.setItem("vaultix_display_name", displayName.trim());
      if (avatar) {
        window.localStorage.setItem("vaultix_avatar", avatar);
      } else {
        window.localStorage.removeItem("vaultix_avatar");
      }
      setProfileSaved(true);
      setProfileError("");
    } catch {
      setProfileSaved(false);
      setProfileError("Could not save your profile in this browser.");
    }
  };

  const handleCopy = () => {
    if (wallet?.publicKey) {
      navigator.clipboard.writeText(wallet.publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        {avatar ? (
          <img src={avatar} alt="Profile avatar" className="h-16 w-16 rounded-full object-cover border border-border" />
        ) : (
          <div className="h-16 w-16 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
            <User className="h-7 w-7" />
          </div>
        )}
        <div>
          <label className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground border border-input rounded-md cursor-pointer hover:bg-accent">
            <ImagePlus className="h-4 w-4" />
            Upload avatar
            <input type="file" accept="image/*" onChange={handleAvatarUpload} className="sr-only" aria-label="Upload avatar" />
          </label>
          <p className="mt-1 text-xs text-muted-foreground">Image files up to 2 MB</p>
        </div>
      </div>
      <div>
        <label htmlFor="display-name" className="block text-xs text-muted-foreground mb-1">Display name</label>
        <input
          id="display-name"
          value={displayName}
          onChange={(event) => { setDisplayName(event.target.value); setProfileSaved(false); }}
          maxLength={80}
          placeholder="Enter your display name"
          className="w-full max-w-sm px-3 py-2 text-sm text-foreground border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">Connected public keys</p>
        {wallet ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="min-w-0 text-sm font-mono bg-muted text-foreground border border-border px-3 py-1.5 rounded-md break-all">
                {wallet.publicKey}
              </code>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 p-1.5 rounded hover:bg-accent transition-colors"
                aria-label="Copy public key"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </div>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>Network: <span className="font-medium text-foreground capitalize">{wallet.network}</span></span>
              <span>Provider: <span className="font-medium text-foreground capitalize">{wallet.walletType}</span></span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No public keys connected</p>
        )}
      </div>
      {profileError && <p role="alert" className="text-sm text-destructive">{profileError}</p>}
      <button
        onClick={handleSaveProfile}
        className="inline-flex items-center gap-2 text-sm px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        <Save className="h-4 w-4" />
        {profileSaved ? "Profile saved" : "Save profile"}
      </button>
    </div>
  );
}

function ProfileSection() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SectionCard title="Profile" icon={User}>
      {mounted ? (
        <ProfileSectionInner />
      ) : (
        <p className="text-sm text-muted-foreground italic">Loading…</p>
      )}
    </SectionCard>
  );
}

// ── Notification Preferences ───────────────────────────────────────────────

const DEFAULT_PREFS: NotificationPref[] = [
  {
    eventType: "ESCROW_FUNDED",
    label: "Escrow funded",
    email: true,
    inApp: true,
  },
  {
    eventType: "MILESTONE_RELEASED",
    label: "Milestone released",
    email: true,
    inApp: true,
  },
  {
    eventType: "DISPUTE_RAISED",
    label: "Dispute raised",
    email: true,
    inApp: true,
  },
  {
    eventType: "DISPUTE_RESOLVED",
    label: "Dispute resolved",
    email: true,
    inApp: true,
  },
  {
    eventType: "ESCROW_EXPIRED",
    label: "Escrow expired",
    email: false,
    inApp: true,
  },
  {
    eventType: "EXPIRATION_WARNING",
    label: "Expiration warning",
    email: true,
    inApp: true,
  },
  {
    eventType: "PARTY_JOINED",
    label: "Party joined",
    email: false,
    inApp: true,
  },
];

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-input"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-background shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function NotificationPrefsSection() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("vaultix_notification_preferences");
      if (stored) {
        const parsed = JSON.parse(stored) as NotificationPref[];
        setPrefs(DEFAULT_PREFS.map((defaultPref) => {
          const savedPref = parsed.find((pref) => pref.eventType === defaultPref.eventType);
          return savedPref ? { ...defaultPref, email: savedPref.email, inApp: savedPref.inApp } : defaultPref;
        }));
      }
    } catch {
      window.localStorage.removeItem("vaultix_notification_preferences");
    }
  }, []);

  const toggle = (index: number, field: "email" | "inApp") => {
    setPrefs((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: !p[field] } : p)),
    );
    setSaved(false);
  };

  const handleSave = () => {
    try {
      window.localStorage.setItem("vaultix_notification_preferences", JSON.stringify(prefs));
      setSaved(true);
      setSaveError("");
    } catch {
      setSaved(false);
      setSaveError("Could not save your preferences in this browser.");
    }
  };

  return (
    <SectionCard title="Notification Preferences" icon={Bell}>
      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 text-xs text-muted-foreground font-medium uppercase tracking-wider px-1">
          <span>Event</span>
          <span>Email</span>
          <span>In-app</span>
        </div>
        {prefs.map((pref, i) => (
          <div
            key={pref.eventType}
            className="grid grid-cols-[1fr_auto_auto] gap-x-6 items-center"
          >
            <span className="text-sm text-foreground">{pref.label}</span>
            <Toggle label={`${pref.label} email notifications`} checked={pref.email} onChange={() => toggle(i, "email")} />
            <Toggle label={`${pref.label} in-app notifications`} checked={pref.inApp} onChange={() => toggle(i, "inApp")} />
          </div>
        ))}
        {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
        <div className="pt-2">
          <button
            onClick={handleSave}
            className="text-sm px-4 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            {saved ? "Saved!" : "Save preferences"}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

// ── API Keys Section ───────────────────────────────────────────────────────

function ApiKeysSection() {
  return <ApiKeyManager />;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        </div>

        <ProfileSection />
        <NotificationPrefsSection />
        <ApiKeysSection />
      </div>
    </div>
  );
}
