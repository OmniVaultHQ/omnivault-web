"use client";

/*
PortfolioChart Component

This renders the line chart showing
the total portfolio value over time.
*/

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";

import { Line } from "react-chartjs-2";

/* Register chart components with Chart.js */
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

/* Props passed from the dashboard */
type Props = {
  labels: string[];
  values: number[];
};

export default function PortfolioChart({ labels, values }: Props) {

  /* Chart dataset */
  const data = {
    labels,
    datasets: [
      {
        label: "Portfolio Value",
        data: values,

        /* Line color */
        borderColor: "#60a5fa",

        /* Fill color under the line */
        backgroundColor: "rgba(96,165,250,0.15)",

        /* Smooth curve */
        tension: 0.4,

        /* Fill under the line */
        fill: true,
      },
    ],
  };

  /* Chart visual options */
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

  /* Render chart */
  return <Line data={data} options={options} />;
}