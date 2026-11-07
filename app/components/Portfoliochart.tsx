"use client";

/*
============================================================
PORTFOLIO CHART
------------------------------------------------------------
Purpose:
- Renders the line chart for portfolio value over time
- Used inside PortfolioAnalytics
============================================================
*/

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

/*
Register chart parts with Chart.js
*/
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

/*
Props passed in from PortfolioAnalytics
*/
type Props = {
  labels: string[];
  values: number[];
};

export default function PortfolioChart({ labels, values }: Props) {
  /*
  Chart dataset
  */
  const data = {
    labels,
    datasets: [
      {
        label: "Portfolio Value",
        data: values,
        borderColor: "#60a5fa",
        backgroundColor: "rgba(96,165,250,0.15)",
        tension: 0.4,
        fill: true,
      },
    ],
  };

  /*
  Chart options
  */
  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        grid: {
          color: "rgba(255,255,255,0.05)",
        },
      },
      y: {
        grid: {
          color: "rgba(255,255,255,0.05)",
        },
      },
    },
  };

  return <Line data={data} options={options} />;
}