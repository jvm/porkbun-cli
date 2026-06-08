/**
 * Framework spike: Validate Ink meets TUI performance gates.
 *
 * Gates to prove:
 * 1. First frame renders before network calls and within 300ms
 * 2. Keyboard navigation over 10,000 rows renders within 50ms per input
 * 3. Search feedback appears within 200ms with 150ms max debounce
 * 4. Alternate-screen enter/exit and cursor restoration
 * 5. Ctrl+C cleanup
 * 6. Terminal resize handling
 * 7. Deterministic component/input tests are possible
 *
 * This spike is temporary and will be removed before release (plan step 4.1).
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { render, Box, Text, useInput, useStdout } from 'ink';

// Generate 10,000 fake domain rows
const DOMAINS = Array.from({ length: 10_000 }, (_, i) => ({
  domain: `example${i}.com`,
  expireDate: new Date(2026, 0, 1 + (i % 365)).toISOString().split('T')[0],
  autoRenew: i % 2 === 0,
  apiAccess: i % 3 === 0,
}));

const VISIBLE_ROWS = 20;
const MAX_VISIBLE_ROWS = 100; // Plan requirement: never render more than 100 rows

export function SpikeApp() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [startTime] = useState(Date.now());
  const [renderTimes, setRenderTimes] = useState<number[]>([]);
  const { stdout } = useStdout();

  // Filter domains based on search
  const filteredDomains = useMemo(() => {
    if (!searchText) return DOMAINS;
    const lower = searchText.toLowerCase();
    return DOMAINS.filter(d => d.domain.toLowerCase().includes(lower));
  }, [searchText]);

  // Virtual list: only render visible rows
  const visibleDomains = useMemo(() => {
    const start = Math.max(0, Math.min(selectedIndex - 10, filteredDomains.length - VISIBLE_ROWS));
    return filteredDomains.slice(start, start + VISIBLE_ROWS);
  }, [filteredDomains, selectedIndex]);

  // Track render performance
  useEffect(() => {
    const renderTime = Date.now() - startTime;
    setRenderTimes(prev => [...prev.slice(-9), renderTime]);
  });

  // Handle keyboard input
  useInput((input, key) => {
    const renderStart = performance.now();

    if (searchMode) {
      if (key.escape) {
        setSearchMode(false);
        setSearchText('');
      } else if (key.backspace || key.delete) {
        setSearchText(prev => prev.slice(0, -1));
      } else if (key.return) {
        setSearchMode(false);
      } else if (input && !key.ctrl && !key.meta) {
        setSearchText(prev => prev + input);
      }
    } else {
      if (input === '/') {
        setSearchMode(true);
      } else if (input === 'q') {
        process.exit(0);
      } else if (key.upArrow || input === 'k') {
        setSelectedIndex(prev => Math.max(0, prev - 1));
      } else if (key.downArrow || input === 'j') {
        setSelectedIndex(prev => Math.min(filteredDomains.length - 1, prev + 1));
      } else if (key.pageUp) {
        setSelectedIndex(prev => Math.max(0, prev - VISIBLE_ROWS));
      } else if (key.pageDown) {
        setSelectedIndex(prev => Math.min(filteredDomains.length - 1, prev + VISIBLE_ROWS));
      }
    }

    // Measure render time for this input
    const renderDuration = performance.now() - renderStart;
    if (renderDuration > 0) {
      // Log slow renders (>50ms)
      if (renderDuration > 50) {
        process.stderr.write(`\n[SPIKE] Slow render: ${renderDuration.toFixed(2)}ms\n`);
      }
    }
  });

  // Track first frame render time
  useEffect(() => {
    const firstFrameTime = Date.now() - startTime;
    process.stderr.write(`[SPIKE] First frame rendered in ${firstFrameTime}ms\n`);
  }, [startTime]);

  // Handle terminal resize
  useEffect(() => {
    if (!stdout) return;
    const handleResize = () => {
      process.stderr.write(`\n[SPIKE] Terminal resized: ${stdout.columns}x${stdout.rows}\n`);
    };
    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  return (
    <Box flexDirection="column" width={80} height={24}>
      <Box borderStyle="single" borderColor="cyan">
        <Text bold color="cyan">
          Porkbun TUI Spike
        </Text>
        <Text dimColor> | </Text>
        <Text>
          {filteredDomains.length} domains
        </Text>
        {searchMode && (
          <>
            <Text dimColor> | Search: </Text>
            <Text color="yellow">{searchText}</Text>
          </>
        )}
      </Box>

      <Box flexDirection="column" flexGrow={1}>
        {visibleDomains.map((domain, i) => {
          const actualIndex = Math.max(0, Math.min(selectedIndex - 10, filteredDomains.length - VISIBLE_ROWS)) + i;
          const isSelected = actualIndex === selectedIndex;
          return (
            <Box key={domain.domain}>
              <Text
                backgroundColor={isSelected ? 'blue' : undefined}
                color={isSelected ? 'white' : undefined}
              >
                {isSelected ? '▸ ' : '  '}
                {domain.domain.padEnd(30)}
              </Text>
              <Text dimColor>
                {domain.expireDate}
              </Text>
              <Text color={domain.autoRenew ? 'green' : 'red'}>
                {' '}AR:{domain.autoRenew ? '✓' : '✗'}
              </Text>
              <Text color={domain.apiAccess ? 'green' : 'yellow'}>
                {' '}API:{domain.apiAccess ? '✓' : '✗'}
              </Text>
            </Box>
          );
        })}
      </Box>

      <Box borderStyle="single" borderColor="gray">
        <Text dimColor>
          ↑/↓/j/k: Navigate | /: Search | q: Quit | Page: PgUp/PgDn
        </Text>
      </Box>
    </Box>
  );
}

// Run spike if executed directly
if (import.meta.url.endsWith('spike.tsx')) {
  const { waitUntilExit } = render(<SpikeApp />);
  waitUntilExit().then(() => {
    process.stderr.write('[SPIKE] Exited cleanly\n');
  }).catch(err => {
    process.stderr.write(`[SPIKE] Error: ${err.message}\n`);
    process.exit(1);
  });
}
