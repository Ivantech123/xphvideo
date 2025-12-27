import React from 'react';
import * as Lucide from 'lucide-react';

interface IconProps extends Lucide.LucideProps {
  name: keyof typeof Lucide;
}

export const Icon: React.FC<IconProps> = ({ name, ...props }) => {
  const LucideIcon = Lucide[name] as React.ElementType;
  if (!LucideIcon) return null;
  return <LucideIcon {...props} />;
};