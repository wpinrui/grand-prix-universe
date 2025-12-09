import {
  Users,
  Newspaper,
  Mail,
  DollarSign,
  UserCog,
  BookUser,
  Car,
  FlaskConical,
  PenTool,
  Hammer,
  FileText,
  Factory,
  Handshake,
  BadgeDollarSign,
  UtensilsCrossed,
  Award,
  ClipboardList,
  SlidersHorizontal,
  Wrench,
  Flag,
  Trophy,
  Medal,
  MapPin,
  BarChart3,
  Scale,
  History,
  Save,
  Settings,
  RotateCcw,
  LogOut,
  Globe,
  User,
  LineChart,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';

export type SectionId = 'team' | 'world' | 'engineering' | 'commercial' | 'racing' | 'fia' | 'options';

export interface SubItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface Section {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  subItems: SubItem[];
}

export const sections: Section[] = [
  {
    id: 'team',
    label: 'TEAM',
    icon: Users,
    subItems: [
      { id: 'profile', label: 'Profile', icon: Users },
      { id: 'mail', label: 'Mail', icon: Mail },
      { id: 'finance', label: 'Finance', icon: DollarSign },
      { id: 'staff', label: 'Staff', icon: UserCog },
      { id: 'wiki', label: 'Player Wiki', icon: BookUser },
    ],
  },
  {
    id: 'world',
    label: 'WORLD',
    icon: Globe,
    subItems: [
      { id: 'news', label: 'News', icon: Newspaper },
      { id: 'teams', label: 'Teams', icon: Users },
      { id: 'drivers', label: 'Drivers', icon: User },
      { id: 'staff', label: 'Staff', icon: UserCog },
      { id: 'stats', label: 'Stats', icon: LineChart },
    ],
  },
  {
    id: 'engineering',
    label: 'ENGINEERING',
    icon: Wrench,
    subItems: [
      { id: 'cars', label: 'Cars', icon: Car },
      { id: 'testing', label: 'Testing', icon: FlaskConical },
      { id: 'design', label: 'Design', icon: PenTool },
      { id: 'construction', label: 'Construction', icon: Hammer },
      { id: 'contracts', label: 'Contracts', icon: FileText },
      { id: 'factory', label: 'Factory', icon: Factory },
    ],
  },
  {
    id: 'commercial',
    label: 'COMMERCIAL',
    icon: Handshake,
    subItems: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'sponsors', label: 'Sponsors', icon: BadgeDollarSign },
      { id: 'deals', label: 'Deals', icon: Handshake },
      { id: 'hospitality', label: 'Hospitality', icon: UtensilsCrossed },
      { id: 'licensing', label: 'Licensing', icon: Award },
    ],
  },
  {
    id: 'racing',
    label: 'RACING',
    icon: Flag,
    subItems: [
      { id: 'orders', label: 'Orders', icon: ClipboardList },
      { id: 'setup', label: 'Car Set-Up', icon: SlidersHorizontal },
      { id: 'assembly', label: 'Assembly', icon: Wrench },
      { id: 'pitlane', label: 'Pit Lane', icon: Flag },
    ],
  },
  {
    id: 'fia',
    label: 'FIA',
    icon: Trophy,
    subItems: [
      { id: 'championship', label: 'Championship', icon: Trophy },
      { id: 'results', label: 'Results', icon: Medal },
      { id: 'races', label: 'Races', icon: MapPin },
      { id: 'ranking', label: 'Ranking', icon: BarChart3 },
      { id: 'regulations', label: 'Regulations', icon: Scale },
      { id: 'history', label: 'History', icon: History },
    ],
  },
  {
    id: 'options',
    label: 'OPTIONS',
    icon: Settings,
    subItems: [
      { id: 'saved-games', label: 'Saved Games', icon: Save },
      { id: 'game-options', label: 'Game Options', icon: Settings },
      { id: 'restart', label: 'Restart Game', icon: RotateCcw },
      { id: 'quit', label: 'Quit', icon: LogOut },
    ],
  },
];

export const defaultSection: SectionId = 'team';
export const defaultSubItem = 'profile';
