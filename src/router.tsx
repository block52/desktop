import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AppBackground from "./components/background/AppBackground";
import Navbar from "./components/navbar/Navbar";
import Dashboard from "./pages/dashboard/Dashboard";
import Table from "./pages/table/Table";
import Wallet from "./pages/Wallet";

const Router: React.FC = () => {
    return (
        <MemoryRouter initialEntries={["/"]}>
            <AppBackground />
            <Navbar />
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/table/:id" element={<Table />} />
                <Route path="/wallet" element={<Wallet />} />
            </Routes>
        </MemoryRouter>
    );
};

export default Router;
