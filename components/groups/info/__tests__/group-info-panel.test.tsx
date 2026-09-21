import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ChatGroupDetail } from '@/lib/actions/chat-groups/types';

vi.mock('@/hooks/social/circle/use-chat-groups', () => ({
  useRenameGroup: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock('@/components/groups/info/group-members-list', () => ({
  GroupMembersList: () => <div>member-list</div>,
}));
vi.mock('@/components/groups/info/group-add-people', () => ({
  GroupAddPeople: () => <div>add-people-form</div>,
}));
vi.mock('@/components/groups/info/group-leave-button', () => ({
  GroupLeaveButton: () => <button type="button">leave-group</button>,
}));

import { GroupInfoPanel } from '../group-info-panel';

const GROUP: ChatGroupDetail = {
  id: 'group-1',
  kind: 'group',
  name: 'Dinner club',
  myRole: 'member',
  members: [],
};

describe('GroupInfoPanel', () => {
  it('keeps members open and starts add people collapsed', async () => {
    const user = userEvent.setup();
    render(<GroupInfoPanel group={GROUP} />);

    const members = screen.getByRole('button', { name: 'membersHeading' });
    const addPeople = screen.getByRole('button', { name: 'addPeople' });

    expect(members).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('member-list')).toBeInTheDocument();
    expect(addPeople).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('add-people-form')).not.toBeInTheDocument();

    await user.click(addPeople);

    expect(addPeople).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('add-people-form')).toBeInTheDocument();
  });
});
