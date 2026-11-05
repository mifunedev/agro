# E7: paused cost

This file gives the storage cost of one paused node for 30 days (720 hours). Arm A keeps the home archive in Cloudflare R2. Arm V keeps one OVH block volume. The machine-readable values are in `cost.json`.

## Prices

| Store | Price | Billing unit | Source |
|---|---|---|---|
| OVH block volume, `high-speed` (the V runs use this type) | $0.000132 per GiB and hour ($0.09636 per GiB for 730 hours) | Each started hour bills as 1 hour | https://api.us.ovhcloud.com/1.0/order/catalog/public/cloud?ovhSubsidiary=US (plan `volume.high-speed.consumption`, unit `GiB*h`) |
| OVH block volume, `classic` | $0.000066 per GiB and hour ($0.04818 per GiB for 730 hours) | Each started hour bills as 1 hour | Same catalog, plan `volume.classic.consumption` |
| Cloudflare R2, Standard storage | $0.015 per GB and month | Usage rounds up to the next GB-month | https://developers.cloudflare.com/r2/pricing/ |

The OVH public price page is https://us.ovhcloud.com/public-cloud/prices/#block-storage. The catalog currency is USD, and the tax rate in the catalog is 0.

R2 bills operations separately from storage. Class A operations cost $4.50 for each million. Class B operations cost $0.36 for each million. Egress is free. One pause writes the archive (Class A), and one restore reads the archive (Class B). These operations cost less than $0.0001 for each node. This file does not add them to the totals.

The R2 free tier gives 10 GB-month of storage, 1 million Class A operations, and 10 million Class B operations each month. The free tier applies to the full account, not to one node. This file does not subtract the free tier.

The R2 page does not define a GB. This file uses 1 GB = 10^9 bytes. This choice gives the higher cost.

## Sizes from the runs

The sizes come from the valid E6 runs. `cost.json` lists each run under `runs`.

| Arm | Size | Valid runs | Stored size |
|---|---|---|---|
| V | 1g | 10 | 10 GiB volume in every run |
| V | 4g | 8 | 10 GiB volume in every run |
| A | 1g | 10 | 1460147596 bytes (median; range 1460118987 to 1460185139) |
| A | 4g | 7 | 4682254899 bytes (median; range 4682223862 to 4682276664) |

The V size comes from `hook.setup.sizing` in each run log. The 1g logs record `used 1.18 GiB + filler 1 GiB + headroom 2 GiB, OVH minimum 10 GiB`. The 4g logs record `used 1.18 GiB + filler 4 GiB + headroom 2 GiB, OVH minimum 10 GiB`. Both sizes are below the OVH minimum, so both volumes are 10 GiB. The volume stays at 10 GiB until used data, filler, and headroom are more than 10 GiB.

The A size comes from `node_recovery_points.archive_size_bytes` for the `pause` recovery point of each valid A run. The A sizes exclude failed runs.

## Cost of one paused node for 30 days

| Arm | 1g | 4g | Calculation |
|---|---|---|---|
| V (`high-speed`) | $0.9504 | $0.9504 | 10 GiB × 720 h × $0.000132 |
| V (`classic`, for comparison) | $0.4752 | $0.4752 | 10 GiB × 720 h × $0.000066 |
| A (R2) | $0.03 | $0.075 | 2 GB-month and 5 GB-month × $0.015, after the round up |

Without the round up, A costs $0.0219 at 1g and $0.0702 at 4g.

For a 730-hour month, V (`high-speed`) costs $0.9636 for each paused node.

## Measured V spend for the E6 campaign

`v-spend.json` records 31 volumes. All 31 volumes are `high-speed` and 10 GiB. The setup hook created the first volume at 2026-11-04T06:14:06.010Z, and the last delete finished at 2026-11-04T16:03:17.991Z. The volumes existed for 8.68 volume-hours in total. With each started hour billed as 1 hour, the campaign cost $0.0409. This cost is below the $10 cap. The ledger shows 0 volumes without a delete time, and `arms/v/list.sh` shows `"run_volumes":0`.

## E7 result

E7 passes for V when the V cost of one paused node for each month is at most $2.00. V costs $0.9504 at 1g and $0.9504 at 4g. E7 passes for V.

A costs less than V at both sizes. The V cost does not change with the workspace size until the volume must be larger than 10 GiB.
