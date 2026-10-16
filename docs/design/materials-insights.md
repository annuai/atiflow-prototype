# Material insights: design for review

Status: **reviewed and translated** (Hindi, Kannada, Malayalam, Tamil).

## Why a separate view

Ati's simplest operation (internal "Tier 0": robots driving between stations, saved routes) has no material context. Showing material numbers to those fleets would be empty or wrong. So:

- Dashboard and Reports each get a **Fleet | Materials** switch. Fleet is unchanged. Materials is a view of its own, never mixed into the fleet cards.
- The switch appears only when a visible fleet runs a published or saved workflow that has a **Material** step, or already has material requests (`hasMaterialWorkflows`, `useMaterialsRelevant`). A person whose fleets run only saved routes sees no switch.
- Saved-route requests (`kind: 'route'`) are never counted as material requests.

## Where the data comes from

Everything is read from the saved material requests (`TripRequest`: status history with times, quantity, material, fleet, stations, robot). No new data is collected. Until a person's fleets have a request, the views show **example data**, labelled with a "Sample data" badge (same convention as Reports). The example data is generated deterministically (`model/sample.ts`) and is not stored.

## Dashboard, Materials view (live, today)

| Item | Meaning |
|---|---|
| Status strip | Warns when the oldest request has waited more than 15 min for approval or 10 min for a robot (placeholder thresholds in `MaterialsLive.tsx`; a Preferences setting later) |
| Requests today | Material requests received since midnight, with the pieces asked for |
| In progress | Waiting for approval + waiting for a robot + on the way |
| Delivered today | Pieces delivered since midnight, and the number of requests |
| Fulfilment | Delivered / everything that ended today (delivered, cancelled, rejected, failed) |
| Request to delivery | Average time from the request to the delivery |
| On the way now | What each robot is carrying: material, pieces, from -> to, robot, time on the way |
| Waiting | Requests for approval and for a robot, with the age of the oldest of each |
| Delivered by hour | Pieces delivered per hour today |
| Most requested today | Top materials by pieces |

## Reports, Materials section (a period)

Same period picker as the fleet report (Today, 7 days, 30 days, custom). Each KPI card compares with the period before (a running period such as today is compared with the same stretch of the one before); green means better for that KPI.

| KPI | Direction | Meaning |
|---|---|---|
| Moved | higher | Pieces delivered (the "how much material moved over a period" figure) |
| Requests | higher | Material requests received |
| Fulfilment | higher | Delivered out of everything that ended |
| Request to delivery | lower | Average cycle time, request to delivered |
| Approval time | lower | Average wait for approval (only requests that need one) |

Also: pieces delivered over time (per hour for one day, per day otherwise), how requests ended (delivered, cancelled, rejected, failed), materials moved (pieces, requests, share), and pieces by fleet (when the person has more than one).

The request-to-delivery time is split in the data into approval, waiting for a robot and carrying (`MaterialStats.approvalMin / robotWaitMin / deliveryMin`); the cards show the whole cycle and the approval part, and the split is ready for a "where does the time go" card.

## Research: what material-flow dashboards usually track, and what we can measure

Public material on AMR fleet software and internal-logistics KPIs is thin on formulas; the common themes (fleet dashboards that visualise material flow and bottlenecks, KPIs for cycle time, on-time delivery, perfect order rate, availability, replenishment time and delays, and their link to throughput and line stoppages) are in the sources below. Mapped to what we can honestly measure today:

| Common KPI | Can we measure it now? |
|---|---|
| Throughput (units moved per period) | Yes: Moved |
| Order / request cycle time | Yes: Request to delivery (and its three parts) |
| Order backlog and age | Yes: Waiting, oldest |
| Fulfilment / perfect-order rate | Yes: Fulfilment (delivered out of ended) |
| Approval turnaround | Yes: Approval time |
| Demand mix | Yes: materials moved, most requested |
| On-time delivery | **No**: a request has no due time. Needs a "needed by" or a target per material (SLA like the fleet's). |
| Line-side stock-outs, buffer coverage, replenishment lead time vs consumption | **No**: needs stock levels at the stations (Master Data has none) |
| Staging-area utilisation | **Partly**: cell states exist in Master Data (filled / reserved / blocked); not wired in yet |
| Cost per move, energy per piece | **No**: the fleet report has energy per trip; per piece needs the pieces carried per trip |
| Pieces per trip / load factor | **Soon**: each request is one material per trip today |

## Review decisions

1. The Fleet | Materials switch is the right separation. Whether Materials also becomes its own sidebar item: decided later.
2. Which missing KPIs come first (on-time delivery, line-side stock-outs, staging utilisation): decided later.
3. Warning thresholds (15 min approval, 10 min robot) stay fixed defaults sitewide; no Preferences setting until there is a requirement.
4. Operators do not get their own version.
5. "Fulfilment" is the right name for delivered out of ended.

## Sources

- [Rockwell Automation: material movement with AMRs (fleet software, KPI dashboards, bottlenecks)](https://www.rockwellautomation.com/en-us/company/news/blogs/material-movement-amrs.html)
- [Seegrid Fleet Geek for AMR analytics (material flow trends, live project status)](https://www.newequipment.com/product-directory/software-computers/product/55121576/52861-seegrids-fleet-geek-provides-actionable-insight-for-palion-amr-analytics)
- [Monitoring and managing KPIs of material handling performance in operative logistics (thesis)](https://www.theseus.fi/handle/10024/340016)
- [Canon: manufacturing analytics for internal logistics performance (OTD, perfect order rate, cycle time)](https://cbps.canon.com/blog/manufacturing-analytics-internal-logistics-performance)
- [Essential material handling KPIs to optimise manufacturing efficiency](https://handling.com/blog/material-handling/essential-material-handling-kpis-to-optimize-your-manufacturing-efficiency/)
- [ProLogistik: plant vs retail warehouse metrics (bottlenecks, machine downtime)](https://www.prologistik.com/en/wp-json/wp/v2/aiglossary/58883)
