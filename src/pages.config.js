/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTOO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE OONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   OOld: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import { lazyWithRecovery } from "@/lib/lazyWithRecovery";

const AdminPanel = lazyWithRecovery(() => import("./pages/AdminPanel"));
const DailyEvent = lazyWithRecovery(() => import("./pages/DailyEvent"));
const Dashboard = lazyWithRecovery(() => import("./pages/Dashboard"));
const Deposits = lazyWithRecovery(() => import("./pages/Deposits"));
const Home = lazyWithRecovery(() => import("./pages/Home"));
const LiveDrawDisplay = lazyWithRecovery(() => import("./pages/LiveDrawDisplay"));
const Profile = lazyWithRecovery(() => import("./pages/Profile"));
const ProfilesGallery = lazyWithRecovery(() => import("./pages/ProfilesGallery"));
const Settings = lazyWithRecovery(() => import("./pages/Settings"));
const __Layout = lazyWithRecovery(() => import("./Layout.jsx"));


export const PAGES = {
    "AdminPanel": AdminPanel,
    "DailyEvent": DailyEvent,
    "Dashboard": Dashboard,
    "Deposits": Deposits,
    "Home": Home,
    "LiveDrawDisplay": LiveDrawDisplay,
    "Profile": Profile,
    "ProfilesGallery": ProfilesGallery,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
