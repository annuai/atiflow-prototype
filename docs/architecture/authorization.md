# Authorization contract (what a real API must enforce)

**Status: the front end only hides and checks.** Everything below is enforced in the browser today (`features/access`, `RequireAccess`, the sidebar, fleet scope in `liveFeed.ts`, the search service), which protects nobody who calls the API directly. This is the list the backend (or the API gateway) has to enforce *again*, per operation. The browser keeps its checks for usability.

## Principles
1. **Never trust the client.** Identity comes from the session (SSO / token), never from a field in the request.
2. **Permission = `<workspace>.<feature>`** (catalog: `features/access/catalog.ts`). A user's effective permissions = their role preset ± the stored differences (`custom {add, remove}`), computed on the server from the stored user record (`features/access/policy.ts` is the reference implementation, pure and tested).
3. **Capability `manageUsers`** belongs to the configurator role, not to a permission tick.
4. **Fleet scope.** Supervisors and operators carry `fleets: string[]` (dataset fleet ids). They may read and act on data of those fleets only; configurators see every fleet. The filter belongs in the *query* (never fetch everything and filter in the client), and in *search*, *notifications*, *reports* and the *live feed* as well.
5. **Deny by default**, and answer "not found" rather than "forbidden" for another fleet's records.
6. **Audit** every write: who, when, what changed (the Action Center and request histories already keep `by` / `at`).

## Operations, permissions and scope
| Domain | Reads | Writes / commands | Scope and rules |
|---|---|---|---|
| Robots, hardware (`configurator.robots`, `configurator.hardware`) | any configurator | add, edit, remove, assign to a fleet | configurator only; a robot's fleet must exist |
| Robot operations (`configurator.robots`) | configuration, calibration, software status | save configuration, run calibration, install software, restore defaults | the robot must be online for calibration and install; restore defaults is destructive (confirm) |
| Fleets (`configurator.fleets`) | scoped roles read only their own fleets | create, rename, assign / unassign map, station groups, delete | delete refused while trips of the fleet are open; rename touches only the fleet record (everything else points at its id) |
| Maps and Map Editor (`configurator.maps`) | published versions to anyone who runs the fleet | draft edits, publish, import, export | a published version is immutable; one draft per map; publish runs the publish checks on the server too; a map belongs to one fleet |
| Master Data (`configurator.master-data`) | materials and staging areas of the person's fleets | import, edit, remove material, edit cells | a material in use by a workflow cannot be removed or unassigned |
| Staging cells (system) | cells of the person's fleets | reserve / take / settle when a request is made or finishes (done by the request service, not by the person) | the request service acts under its own identity; cells are never edited by an operator directly |
| Workflows (`configurator.workflows`) | scoped roles: published workflows of their fleets they are listed in | create, edit, save draft, publish | publish needs the publish checks (users named, stations exist); only Tablet workflows with the person in Start are requestable |
| Requests (`operator.book-trip`, `operator.approve`) | own requests; requests waiting for the person's approval | request, cancel (own, until a robot is on its way), approve, reject | a requester never approves their own request; each Tablet Confirm step is one approval by one of its users; fleet in the person's scope |
| History (`operator.history`) | the person's own requests, approvals made or possible, and booked trips | cancel own request / trip while allowed | own items only; approvals shown only for steps the person may decide |
| Booked trips (`operator.book-trip`) | own trips | book, cancel own | fleet in scope; robot type must exist on the fleet |
| Live Floor (`supervisor.live-floor`) | telemetry and events of the person's fleets | send to charger, relocalize | robot in scope; refused states are part of the contract (`ChargeResult`, `RelocalizeResult`) |
| Dashboard, Reports (`supervisor.dashboard`, `supervisor.reports`) | metrics of the person's fleets (reports also for a chosen fleet inside the scope) | none | aggregate only inside the scope |
| Action Center (`supervisor.action-center`, `operator.action-center`) | open calls of the person's fleets | take, release, resolve | the resolved log is shared per site; entries show only fleets in scope |
| Settings (`configurator.settings`) | connection status | edit connections, test, sync | secrets (client secret) are write-only: never returned to the browser |
| Personal settings (`supervisor.settings`, `operator.settings`) | own preferences | own preferences only | a user can never read or write another user's preferences |
| Users (capability `manageUsers`) | list and detail | add, edit, role and permission changes, reset password, delete | nobody deletes themselves; role change starts from the role's preset; passwords exist only in the auth service |
| Search (any workspace) | results from entities the person has a permission for, inside their scope | none | permission and scope are applied **before** ranking; the index never contains data the person may not see |
| Notifications | the person's own, audience of the open workspace | mark read (own) | per user |
| Support (everyone signed in) | own tickets | create, reply, close, callback | per user; ticket context (page, robot) is added server-side from the session |

## Not enforceable from the document-shaped ports
Today's ports save whole documents (`workflows.save(all)`, `dataset.save(all)`). A real API must expose **operations** (add robot, assign to fleet, publish workflow, approve step...) so the server can check permission and scope per operation and per record. Phase 3 of the production plan (`docs/architecture/foundations.md`) refines the ports this way; this table is the checklist for it.
