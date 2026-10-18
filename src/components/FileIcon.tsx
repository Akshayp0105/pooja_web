import { BookOpen, File, Film, Image, Music } from 'lucide-react';
import { cn, fileKind } from '../lib/cn';

const STYLES = {
  image: { Icon: Image, tone: 'bg-lotus-soft text-lotus' },
  video: { Icon: Film, tone: 'bg-[#EEF2E8] text-leaf' },
  audio: { Icon: Music, tone: 'bg-[#FFF1DC] text-saffron' },
  book: { Icon: BookOpen, tone: 'bg-parchment text-gold-deep' },
  file: { Icon: File, tone: 'bg-sand/50 text-maroon/70' },
};

export function FileIcon({ type, name, className }: { type: string; name: string; className?: string }) {
  const { Icon, tone } = STYLES[fileKind(type, name)];
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-xl', tone, className ?? 'h-11 w-11')}>
      <Icon className="h-[45%] w-[45%]" strokeWidth={1.8} />
    </span>
  );
}
