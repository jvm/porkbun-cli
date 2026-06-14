/**
 * AppFrame - main layout with header, navigation, main content, footer, modal layer.
 * Implements responsive breakpoints per PRD section 9.2.
 */
import React from "react";
import { Box } from "ink";
import { Text } from "../text.js";
import type { TerminalCapabilities } from "../types.js";
import { getBreakpoint } from "../types.js";
import type { Theme } from "../theme.js";

interface AppFrameProps {
  terminal: TerminalCapabilities;
  theme: Theme;
  header: React.ReactNode;
  navigation?: React.ReactNode;
  main: React.ReactNode;
  footer: React.ReactNode;
  modal?: React.ReactNode;
}

export function AppFrame({
  terminal,
  theme,
  header,
  navigation,
  main,
  footer,
  modal,
}: AppFrameProps) {
  const breakpoint = getBreakpoint(terminal.columns, terminal.rows);

  if (breakpoint === "minimum") {
    return (
      <Box flexDirection="column" width={terminal.columns} height={terminal.rows}>
        <Box borderStyle="single" borderColor="red" padding={1}>
          <Text color="red">
            Terminal too small ({terminal.columns}×{terminal.rows}). Minimum: 60×18. Press q to
            exit.
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={terminal.columns} height={terminal.rows}>
      {/* Header */}
      <Box borderStyle="single" borderColor={theme.colors.primary}>
        {header}
      </Box>

      {/* Main content area */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Navigation sidebar (wide only) */}
        {breakpoint === "wide" && navigation && (
          <Box borderStyle="single" borderColor="gray" width={20}>
            {navigation}
          </Box>
        )}

        {/* Main content */}
        <Box flexDirection="column" flexGrow={1} paddingX={1}>
          {main}
        </Box>
      </Box>

      {/* Footer */}
      <Box borderStyle="single" borderColor="gray">
        {footer}
      </Box>

      {/* Modal overlay */}
      {modal && (
        <Box position="absolute" top={0} left={0} width={terminal.columns} height={terminal.rows}>
          {modal}
        </Box>
      )}
    </Box>
  );
}
