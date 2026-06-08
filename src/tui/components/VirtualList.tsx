/**
 * VirtualList - bounded rendering for large lists with scroll preservation.
 * Never renders more than 100 rows (PRD requirement).
 */
import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../theme.js';

interface VirtualListProps<T> {
  items: T[];
  selectedIndex: number;
  renderItem: (item: T, index: number, isSelected: boolean) => React.ReactNode;
  maxVisible?: number;
  theme: Theme;
}

const MAX_VISIBLE_ROWS = 100;
const DEFAULT_VISIBLE_ROWS = 20;

export function VirtualList<T>({
  items,
  selectedIndex,
  renderItem,
  maxVisible = DEFAULT_VISIBLE_ROWS,
  theme,
}: VirtualListProps<T>) {
  const visibleCount = Math.min(maxVisible, MAX_VISIBLE_ROWS);

  // Calculate visible window
  const { startIndex, visibleItems } = useMemo(() => {
    const start = Math.max(
      0,
      Math.min(selectedIndex - Math.floor(visibleCount / 2), items.length - visibleCount)
    );
    return {
      startIndex: start,
      visibleItems: items.slice(start, start + visibleCount),
    };
  }, [items, selectedIndex, visibleCount]);

  if (items.length === 0) {
    return (
      <Box padding={1}>
        <Text dimColor>No items.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Scroll indicator */}
      {startIndex > 0 && (
        <Box>
          <Text dimColor>
            ↑ {startIndex} more above
          </Text>
        </Box>
      )}

      {/* Visible items */}
      {visibleItems.map((item, i) => {
        const actualIndex = startIndex + i;
        const isSelected = actualIndex === selectedIndex;
        return (
          <Box key={actualIndex}>
            {renderItem(item, actualIndex, isSelected)}
          </Box>
        );
      })}

      {/* Scroll indicator */}
      {startIndex + visibleCount < items.length && (
        <Box>
          <Text dimColor>
            ↓ {items.length - startIndex - visibleCount} more below
          </Text>
        </Box>
      )}
    </Box>
  );
}
