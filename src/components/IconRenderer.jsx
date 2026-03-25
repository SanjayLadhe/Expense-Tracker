import * as Icons from 'lucide-react';

export default function IconRenderer({ name, className, size = 20, ...props }) {
  const Cmp = Icons[name];
  if (!Cmp) return <Icons.Circle className={className} size={size} {...props} />;
  return <Cmp className={className} size={size} {...props} />;
}
