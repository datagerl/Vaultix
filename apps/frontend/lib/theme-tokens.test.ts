/**
 * Guards files that have been migrated to semantic colour tokens against
 * regressing to raw neutral palette classes (bg-white, text-gray-700, …),
 * which only look right in one theme. Add a file here once it is migrated.
 *
 * Translucent scrims such as `bg-black/50` are allowed: they work on either theme.
 */
import fs from 'fs';
import path from 'path';

const TOKENIZED_FILES = [
  'app/settings/page.tsx',
  'components/ThemeToggle.tsx',
  'components/layout/Navbar.tsx',
  'components/layout/MobileNav.tsx',
  'components/common/Pagination.tsx',
  'components/common/SkipLink.tsx',
  'components/ui/input.tsx',
  'components/ui/select.tsx',
  'components/ui/textarea.tsx',
  'components/ui/Skeleton.tsx',
];

const RAW_NEUTRAL =
  /\b(?:[\w-]+:)*(?:bg|text|border|ring|divide|outline|placeholder|from|via|to)-(?:white|black|gray|slate|zinc|neutral|stone)(?:-\d{2,3})?(?![\w/-])/g;

describe('semantic colour tokens', () => {
  it.each(TOKENIZED_FILES)('%s uses tokens instead of raw neutral colours', (file) => {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    expect(source.match(RAW_NEUTRAL) ?? []).toEqual([]);
  });

  it('pattern catches raw colours and allows scrims', () => {
    const sample = 'bg-white text-gray-700 dark:bg-gray-900 hover:text-black bg-black/50 bg-background';
    expect(sample.match(RAW_NEUTRAL)).toEqual(['bg-white', 'text-gray-700', 'dark:bg-gray-900', 'hover:text-black']);
  });
});
