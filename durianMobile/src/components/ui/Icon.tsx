import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  BookOpen,
  Bookmark,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Trash2,
  Droplet,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  ScanLine,
  Search,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Sprout,
  Sun,
  User,
  Wallet,
  Home,
  Bug,
  ChevronLeft,
  ChevronUp,
  Cloud,
  FileText,
  Globe,
  Image as ImageIcon,
  Info,
  Leaf,
  LogOut,
  Menu,
  Navigation,
  Package,
  Receipt,
  RefreshCw,
  Send,
  Settings,
  Share2,
  Star,
  TrendingUp,
  Users,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react-native';

import { colors, type ColorToken } from '@/theme';

/** Icons used by the design. Names are semantic so the underlying set can change. */
const icons = {
  home: Home,
  sprout: Sprout,
  scan: ScanLine,
  book: BookOpen,
  user: User,
  bell: Bell,
  chat: MessageSquare,
  search: Search,
  plus: Plus,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  back: ArrowLeft,
  alert: AlertTriangle,
  clock: Clock,
  check: Check,
  camera: Camera,
  wallet: Wallet,
  calendar: Calendar,
  phone: Phone,
  mapPin: MapPin,
  bookmark: Bookmark,
  download: Download,
  water: Droplet,
  flower: Sun,
  harvest: ShoppingBag,
  shield: Shield,
  shieldCheck: ShieldCheck,
  close: X,
  send: Send,
  star: Star,
  share: Share2,
  settings: Settings,
  globe: Globe,
  wifiOff: WifiOff,
  image: ImageIcon,
  info: Info,
  refresh: RefreshCw,
  trash: Trash2,
  logout: LogOut,
  cloud: Cloud,
  navigation: Navigation,
  chevronLeft: ChevronLeft,
  chevronUp: ChevronUp,
  receipt: Receipt,
  users: Users,
  package: Package,
  leaf: Leaf,
  bug: Bug,
  file: FileText,
  trendingUp: TrendingUp,
  menu: Menu,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

export interface IconProps {
  name: IconName;
  size?: number;
  /** A colour token, or a raw colour (e.g. from `tones`). */
  color?: ColorToken | (string & {});
  strokeWidth?: number;
  /** Fill the shape with the icon colour (e.g. a saved bookmark). */
  filled?: boolean;
}

export function Icon({
  name,
  size = 24,
  color = 'text',
  strokeWidth = 2,
  filled = false,
}: IconProps) {
  const Cmp = icons[name];
  const resolved = color in colors ? colors[color as ColorToken] : color;
  return (
    <Cmp
      size={size}
      color={resolved}
      strokeWidth={strokeWidth}
      fill={filled ? resolved : 'none'}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
