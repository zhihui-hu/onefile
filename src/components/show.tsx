interface ShowProps {
  when: boolean;
  fallback?: React.ReactNode;
}

export default function Show({
  children,
  when,
  fallback = null,
}: React.PropsWithChildren<ShowProps>) {
  return when ? children : fallback;
}
