import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AppBackground from "./components/background/AppBackground";
import Sidebar from "./components/sidebar/Sidebar";
import Dashboard from "./pages/dashboard/Dashboard";
import Table from "./pages/table/Table";
import Wallet from "./pages/Wallet";

const Router: React.FC = () => {
    return (
        <MemoryRouter initialEntries={["/"]}>
            <AppBackground />
            <div style={{ position: "relative", display: "flex", minHeight: "100vh" }}>
                <Sidebar />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/table/:id" element={<Table />} />
                        <Route path="/wallet" element={<Wallet />} />
                    </Routes>
                </div>
            </div>
        </MemoryRouter>
    );
};

export default Router;
