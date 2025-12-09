import { CenteredMessage } from '../../components';

interface WorldDriversProps {
  initialDriverId?: string | null;
}

export function WorldDrivers({ initialDriverId }: WorldDriversProps) {
  return (
    <CenteredMessage
      title="World Drivers"
      subtitle={initialDriverId ? `Driver: ${initialDriverId}` : 'Coming soon'}
    />
  );
}
