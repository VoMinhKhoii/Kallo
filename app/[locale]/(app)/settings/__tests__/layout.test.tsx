import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SettingsLayout from '../layout';

describe('SettingsLayout', () => {
  it('keeps settings as the contained vertical scroller', () => {
    const { container } = render(
      <SettingsLayout>
        <div>Settings</div>
      </SettingsLayout>
    );

    expect(container.firstElementChild).toHaveClass(
      'min-h-0',
      'flex-1',
      'overflow-y-auto',
      'overscroll-contain'
    );
  });
});
