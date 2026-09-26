import { Clapperboard, Image as ImageIcon, Music, Palette, Scissors, Type, type LucideIcon } from 'lucide-react';
import type { NodeKind } from '../types';

export const nodeIcon: Record<NodeKind, LucideIcon> = {
  audio: Music,
  visual: ImageIcon,
  text: Type,
  style: Palette,
  montage: Scissors,
  output: Clapperboard,
};
