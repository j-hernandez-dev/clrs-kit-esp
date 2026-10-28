import {
    useEffect,
    useMemo,
    useRef
} from "react";
import {
    Chart,
    Filler,
    Legend,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Tooltip
} from "chart.js";

import {
    createAsymptoticGrowthProfile
} from "./AsymptoticGrowthProfile.js";

Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    Filler,
    Legend,
    Tooltip
);

export default function AsymptoticGrowthChart({
    scenario
}) {
    const canvasRef = useRef(null);
    const notation =
        scenario.conclusion?.notation ??
        scenario.asymptotic.notation;
    const profile = useMemo(
        () => createAsymptoticGrowthProfile(
            notation
        ),
        [notation]
    );

    useEffect(
        () => {
            const canvas = canvasRef.current;

            if (!canvas) {
                return undefined;
            }

            let chart = null;
            const render = () => {
                chart?.destroy();
                chart = createChart(
                    canvas,
                    profile
                );
            };

            render();

            const observer =
                new MutationObserver(render);

            observer.observe(
                document.documentElement,
                {
                    attributes: true,
                    attributeFilter: [
                        "class",
                        "style"
                    ]
                }
            );

            return () => {
                observer.disconnect();
                chart?.destroy();
            };
        },
        [profile]
    );

    return (
        <section className="growth-chart">
            <header>
                <strong>
                    Crecimiento asintótico
                </strong>
                <span>{notation}</span>
            </header>
            <div className="growth-chart-canvas">
                <canvas
                    ref={canvasRef}
                    role="img"
                    aria-label={profile.available
                        ? `Gráfica de crecimiento ${notation}. Eje horizontal: Tamaño de entrada. Eje vertical: Tiempo de ejecución.`
                        : "Gráfica de crecimiento sin datos porque la complejidad no está determinada. Eje horizontal: Tamaño de entrada. Eje vertical: Tiempo de ejecución."}
                />
            </div>
        </section>
    );
}

function createChart(canvas, profile) {
    const styles = getComputedStyle(
        document.documentElement
    );
    const foreground = cssColor(
        styles,
        "--vscode-descriptionForeground",
        "#9298a3"
    );
    const border = cssColor(
        styles,
        "--vscode-panel-border",
        "#343840"
    );
    const fontFamily = cssColor(
        styles,
        "--vscode-font-family",
        "Segoe UI"
    );
    const points = profile.samples.map(
        sample => ({
            x: sample.size,
            y: sample.time
        })
    );

    return new Chart(canvas, {
        type: "line",
        data: {
            datasets: profile.available ? [{
                label: profile.notation,
                data: points,
                borderColor: profile.color,
                backgroundColor:
                    profile.fillColor,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 3,
                pointHoverBackgroundColor:
                    profile.color,
                fill: true,
                tension: 0.3
            }] : []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 260
            },
            interaction: {
                intersect: false,
                mode: "nearest"
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    displayColors: false,
                    callbacks: {
                        title(items) {
                            return `Tamaño de entrada: ${items[0].parsed.x}`;
                        },
                        label(context) {
                            return `Tiempo de ejecución: ${formatTime(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                x: axisOptions({
                    title: "Tamaño de entrada",
                    foreground,
                    border,
                    fontFamily,
                    beginAtZero: true
                }),
                y: axisOptions({
                    title: "Tiempo de ejecución",
                    foreground,
                    border,
                    fontFamily,
                    beginAtZero: true
                })
            }
        }
    });
}

function axisOptions({
    title,
    foreground,
    border,
    fontFamily,
    beginAtZero = false
}) {
    return {
        type: "linear",
        beginAtZero,
        title: {
            display: true,
            text: title,
            color: foreground,
            font: {
                family: fontFamily,
                size: 10,
                weight: "normal"
            }
        },
        ticks: {
            color: foreground,
            maxTicksLimit: 6,
            font: {
                family: fontFamily,
                size: 9
            }
        },
        grid: {
            color: border
        },
        border: {
            color: border
        }
    };
}

function cssColor(styles, name, fallback) {
    return styles.getPropertyValue(name)
        .trim() || fallback;
}

function formatTime(value) {
    return new Intl.NumberFormat("es-MX", {
        maximumFractionDigits: 2,
        notation:
            Math.abs(value) >= 1_000_000
                ? "compact"
                : "standard"
    }).format(value);
}
