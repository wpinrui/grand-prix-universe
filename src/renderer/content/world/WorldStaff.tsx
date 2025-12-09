import { CenteredMessage } from '../../components';

interface WorldStaffProps {
  initialStaffId?: string | null;
}

export function WorldStaff({ initialStaffId }: WorldStaffProps) {
  return (
    <CenteredMessage
      title="World Staff"
      subtitle={initialStaffId ? `Staff: ${initialStaffId}` : 'Coming soon'}
    />
  );
}
