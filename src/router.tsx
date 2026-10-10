import React, { useCallback, useState } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import AppBackground from "./components/background/AppBackground";
import Sidebar from "./components/sidebar/Sidebar";
import Dashboard from "./pages/dashboard/Dashboard";
import HandHistory from "./pages/handHistory/HandHistory";
import BlockExplorer from "./pages/blockExplorer/BlockExplorer";
import HandDistribution from "./pages/handDistribution/HandDistribution";
import Nodes from "./pages/nodes/Nodes";
import TechNotes from "./pages/techNotes/TechNotes";
import Table from "./pages/table/Table";
import Wallet from "./pages/Wallet";
import styles from "./router.module.css";

const Shell: React.FC = () => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const closeDrawer = useCallback(() => setDrawerOpen(false), []);
    const location = useLocation();
    // Table screen is full-width like the mock — no rail; the hamburger opens nav.
    const isTable = location.pathname.startsWith("/table/");
    const sidebarHidden = isTable && !drawerOpen;

    return (
        <>
            <div className={styles.shell}>
                <div className={styles.sidebarSlot} data-hidden={sidebarHidden ? "true" : undefined}>
                    <Sidebar drawerOpen={drawerOpen} onCloseDrawer={closeDrawer} />
                </div>
                <div className={styles.rightCol}>
                    <main className={isTable ? styles.mainBare : `pane ${styles.mainPane}`}>
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/hand-history" element={<HandHistory />} />
                            <Route path="/explorer" element={<BlockExplorer />} />
                            <Route path="/hand-distribution" element={<HandDistribution />} />
                            <Route path="/nodes" element={<Nodes />} />
                            <Route path="/tech-notes" element={<TechNotes />} />
                            <Route path="/table/:id" element={<Table onOpenNav={() => setDrawerOpen(true)} />} />
                            <Route path="/wallet" element={<Wallet />} />
                        </Routes>
                    </main>
                </div>
            </div>
            <button
                type="button"
                className={`btn-ghost ${styles.menuButton}`}
                onClick={() => setDrawerOpen(true)}
                aria-label="Open navigation"
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 6h16" />
                    <path d="M4 12h16" />
                    <path d="M4 18h16" />
                </svg>
            </button>
        </>
    );
};

const Router: React.FC = () => {
    return (
        <MemoryRouter initialEntries={["/"]}>
            <AppBackground />
            <Shell />
        </MemoryRouter>
    );
};

export default Router;
