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
  Trophy,
  Medal,
  MapPin,
  History,
  Save,
  Settings,
  LogOut,
  Globe,
  User,
  LineChart,
  Home,
  Inbox,
  Wrench,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';

export type SectionId = 'home' | 'inbox' | 'team' | 'engineering' | 'design' | 'world' | 'commercial' | 'championship' | 'options';

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
    id: 'home',
    label: 'HOME',
    icon: Home,
    subItems: [
      { id: 'home', label: 'Home', icon: Home },
      { id: 'profile', label: 'My Profile', icon: BookUser },
    ],
  },
  {
    id: 'inbox',
    label: 'INBOX',
    icon: Inbox,
    subItems: [
      { id: 'inbox', label: 'Inbox', icon: Mail },
      { id: 'news', label: 'News', icon: Newspaper },
    ],
  },
  {
    id: 'team',
    label: 'TEAM',
    icon: Users,
    subItems: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'drivers', label: 'Drivers', icon: User },
      { id: 'staff', label: 'Staff', icon: UserCog },
      { id: 'factory', label: 'Factory', icon: Factory },
    ],
  },
  {
    id: 'engineering',
    label: 'ENGINEERING',
    icon: Wrench,
    subItems: [
      { id: 'cars', label: 'Cars', icon: Car },
      { id: 'testing', label: 'Testing', icon: FlaskConical },
      { id: 'construction', label: 'Construction', icon: Hammer },
    ],
  },
  {
    id: 'design',
    label: 'DESIGN',
    icon: PenTool,
    subItems: [
      { id: 'summary', label: 'Summary', icon: PenTool },
      { id: 'current-chassis', label: 'Current Chassis', icon: Car },
      { id: 'next-chassis', label: 'Next Chassis', icon: Car },
      { id: 'technology', label: 'Technology', icon: FlaskConical },
    ],
  },
  {
    id: 'world',
    label: 'WORLD',
    icon: Globe,
    subItems: [
      { id: 'teams', label: 'Teams', icon: Users },
      { id: 'drivers', label: 'Drivers', icon: User },
      { id: 'staff', label: 'Staff', icon: UserCog },
      { id: 'stats', label: 'Stats', icon: LineChart },
    ],
  },
  {
    id: 'commercial',
    label: 'COMMERCIAL',
    icon: Handshake,
    subItems: [
      { id: 'finance', label: 'Finance', icon: DollarSign },
      { id: 'sponsors', label: 'Sponsors', icon: BadgeDollarSign },
      { id: 'contracts', label: 'Contracts', icon: FileText },
    ],
  },
  {
    id: 'championship',
    label: 'CHAMPIONSHIP',
    icon: Trophy,
    subItems: [
      { id: 'standings', label: 'Standings', icon: Trophy },
      { id: 'results', label: 'Full Results', icon: Medal },
      { id: 'races', label: 'Races', icon: MapPin },
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
      { id: 'quit', label: 'Quit', icon: LogOut },
    ],
  },
];

export const defaultSection: SectionId = 'home';
export const defaultSubItem = 'home';
