//------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------- Move Side Collection into Production ---------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/* Timing */
var start = new Date();
print("atomic_update_prioritized_dashboard.js -- Starting at "+start);
/* End Timing */

db.runCommand({ renameCollection: "gt-prioritized-dashboard.side_prioritized_dashboard",
                to: "gt-prioritized-dashboard.prioritized_dashboard_entries",
                dropTarget: true });

/* Timing */
var end = new Date();
var dur = end-start;
print("atomic_update_prioritized_dashboard.js -- Completed at "+end);
print("atomic_update_prioritized_dashboard.js -- Duration: "+dur/60000+"m");
/* End Timing */

