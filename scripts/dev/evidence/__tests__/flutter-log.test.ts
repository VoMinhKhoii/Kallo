import { describe, expect, it } from 'vitest';
import { flutterIssues } from '../flutter-log.mjs';

describe('flutterIssues', () => {
  it('finds nothing in a clean run', () => {
    const log = [
      'Launching lib/main.dart on iPhone 17 Pro Max in debug mode...',
      'Xcode build done.                                           42.1s',
      'flutter: [auth] session restored',
      'Syncing files to device iPhone 17 Pro Max...',
    ].join('\n');
    expect(flutterIssues(log)).toEqual([]);
  });

  it('names a caught exception block by its message and drops its repeats', () => {
    const block = [
      'flutter: ══╡ EXCEPTION CAUGHT BY RENDERING LIBRARY ╞═════════════════════════',
      'flutter: The following assertion was thrown during layout:',
      'flutter: A RenderFlex overflowed by 42 pixels on the right.',
      'flutter:',
      'flutter: The relevant error-causing widget was:',
    ];
    expect(flutterIssues([...block, ...block].join('\n'))).toEqual([
      'rendering library: A RenderFlex overflowed by 42 pixels on the right.',
    ]);
  });

  it('catches one-line errors on iOS and Android prefixes', () => {
    const log = [
      'flutter: Another exception was thrown: Null check operator used on a null value',
      '[ERROR:flutter/runtime/dart_vm_initializer.cc(40)] Unhandled Exception: SocketException: Connection refused',
      'I/flutter (1234): Another exception was thrown: setState() called after dispose()',
    ].join('\n');
    expect(flutterIssues(log)).toEqual([
      'Another exception was thrown: Null check operator used on a null value',
      'Unhandled Exception: SocketException: Connection refused',
      'Another exception was thrown: setState() called after dispose()',
    ]);
  });
});
