//------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------Reset gt-prioritized-dashboard/side_prioritized_dashboard--------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/* Timing */
var start = new Date();
print("reset_side_prioritized_dashboard.js -- Starting at "+start);
/* End Timing */

// drop, create empty, add the index we need (on user_id and score)
db.side_prioritized_dashboard.drop();
db.createCollection("side_prioritized_dashboard");
db.side_prioritized_dashboard.ensureIndex({'a':1, 'score':-1});

/* Timing */
var end = new Date();
var dur = end-start;
print("reset_side_prioritized_dashboard.js -- Completed at "+end);
print("reset_side_prioritized_dashboard.js -- Duration: "+dur/60000+"m");
/* End Timing */

