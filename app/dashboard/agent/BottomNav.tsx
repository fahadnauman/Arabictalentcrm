"use client";

import Link          from "next/link";
import { usePathname } from "next/navigation";
import FollowUpAlertWatcher from "./FollowUpAlertWatcher";
import GlobalLeadNotificationWatcher from "./GlobalLeadNotificationWatcher";
import styles from "./agent.module.css";

const IconHome  = () => (
  <svg
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`${styles.navIcon} w-6 h-6 flex-shrink-0`}
    style={{ width: 24, height: 24, minWidth: 24, minHeight: 24, maxWidth: 24, maxHeight: 24, flexShrink: 0 }}
  >
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const IconInbox = () => (
  <svg
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`${styles.navIcon} w-6 h-6 flex-shrink-0`}
    style={{ width: 24, height: 24, minWidth: 24, minHeight: 24, maxWidth: 24, maxHeight: 24, flexShrink: 0 }}
  >
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  </svg>
);

const IconVault = () => (
  <svg
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`${styles.navIcon} w-6 h-6 flex-shrink-0`}
    style={{ width: 24, height: 24, minWidth: 24, minHeight: 24, maxWidth: 24, maxHeight: 24, flexShrink: 0 }}
  >
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M3 9h18M9 21V9"/>
  </svg>
);

const IconInfo  = () => (
  <svg
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`${styles.navIcon} w-6 h-6 flex-shrink-0`}
    style={{ width: 24, height: 24, minWidth: 24, minHeight: 24, maxWidth: 24, maxHeight: 24, flexShrink: 0 }}
  >
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 16v-4"/>
    <path d="M12 8h.01"/>
  </svg>
);

export default function AgentBottomNav() {
  const path = usePathname();

  const tabs = [
    { href: "/dashboard/agent",           label: "Home",  Icon: IconHome  },
    { href: "/dashboard/agent/inbox",     label: "Inbox", Icon: IconInbox },
    { href: "/dashboard/agent/portfolio", label: "Info",  Icon: IconInfo  },
    { href: "/dashboard/agent/vault",     label: "Log",   Icon: IconVault },
  ];

  return (
    <>
      <FollowUpAlertWatcher />
      <GlobalLeadNotificationWatcher />
      <nav className={`${styles.bottomNav} fixed bottom-0 w-full z-50 flex md:hidden`}>
        {tabs.map(({ href, label, Icon }) => {
          const active = path === href;
          return (
            <Link key={href} href={href} className={`${styles.navItem} ${active ? styles.activeNav : ""}`}>
              <Icon />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
