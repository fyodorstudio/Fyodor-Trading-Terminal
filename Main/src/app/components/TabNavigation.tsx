import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { TabId } from "@/app/types";

interface TabNavigationProps {
  activeTab: TabId;
  setActiveTab: (id: TabId) => void;
  tabOrder: { id: TabId; label: string; children?: { id: TabId; label: string }[] }[];
}

export function TabNavigation({ activeTab, setActiveTab, tabOrder }: TabNavigationProps) {
  const [openMenuId, setOpenMenuId] = useState<TabId | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!navRef.current?.contains(target)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const activeParentId = useMemo(() => {
    const parent = tabOrder.find((tab) => tab.children?.some((child) => child.id === activeTab));
    return parent?.id ?? null;
  }, [activeTab, tabOrder]);

  return (
    <nav ref={navRef} className="tab-nav-wrap">
      <div className="tab-nav">
      {tabOrder.map((tab) => {
        const isActive = activeTab === tab.id || activeParentId === tab.id;
        const hasChildren = Boolean(tab.children && tab.children.length > 0);
        return (
          <div key={tab.id} className="tab-item">
            <button
              type="button"
              onClick={() => {
                if (hasChildren) {
                  setOpenMenuId((current) => (current === tab.id ? null : tab.id));
                  return;
                }
                setOpenMenuId(null);
                setActiveTab(tab.id);
              }}
              className={`tab-button ${isActive ? "is-active" : ""} ${hasChildren ? "has-children" : ""}`}
              aria-expanded={hasChildren ? openMenuId === tab.id : undefined}
            >
              <span>{tab.label}</span>
              {hasChildren && (
                <ChevronDown
                  size={14}
                  className={`tab-button-caret ${openMenuId === tab.id ? "is-open" : ""}`}
                />
              )}
            </button>

            {hasChildren && openMenuId === tab.id && (
              <div className="tab-menu">
                {tab.children!.map((child) => {
                  const childActive = activeTab === child.id;
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(child.id);
                        setOpenMenuId(null);
                      }}
                      className={`tab-menu-button ${childActive ? "is-active" : ""}`}
                    >
                      <span>{child.label}</span>
                      {childActive && <span className="tab-menu-state">Open</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </nav>
  );
}
