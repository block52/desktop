import React from "react";
import { useParams } from "react-router-dom";

const Table: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    return <div>Table {id}</div>;
};

export default Table;
