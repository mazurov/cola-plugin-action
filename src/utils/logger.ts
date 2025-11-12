import * as core from '@actions/core';

/**
 * Logger utility wrapping @actions/core
 * Provides consistent logging throughout the action
 */

export class Logger {
  info(message: string): void {
    core.info(`ℹ ${message}`);
  }

  success(message: string): void {
    core.info(`✓ ${message}`);
  }

  warning(message: string): void {
    core.warning(`⚠ ${message}`);
  }

  error(message: string | Error): void {
    const msg = message instanceof Error ? message.message : message;
    core.error(`✗ ${msg}`);
  }

  header(message: string): void {
    const separator = '='.repeat(50);
    core.info('');
    core.info(separator);
    core.info(message);
    core.info(separator);
  }

  section(message: string): void {
    const separator = '='.repeat(message.length);
    core.info('');
    core.info(message);
    core.info(separator);
  }

  debug(message: string): void {
    core.debug(message);
  }

  startGroup(name: string): void {
    core.startGroup(name);
  }

  endGroup(): void {
    core.endGroup();
  }
}

// Singleton instance
export const logger = new Logger();
