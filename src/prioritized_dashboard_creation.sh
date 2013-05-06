#!/bin/bash
#
# prioritized_dashboard_creation.sh
#
# Runs all of the necessary remote MongoDB MapReduces, collecting and importing the results to local MongoDB.
# Generates the Entertainment Graph locally and atomically updates gt-prioritized-dashboard/prioritized_dashboard
#
# Usage:
#  ./prioritized_dashboard_creation.sh
#  Enviroment must have RUN_FRIENDSHIPS=1 for the MapReduce of rolls to friendships to run
#  ie: `RUN_FRIENDSHIPS=1 ./prioritized_dashboard_creation.sh`
#
# Example Cron implementation
# Run (w/ friendships) daily at 3am EST (07:00 UTC)
# 00 07 * * * cd ~/big_data && RUN_FRIENDSHIPS=1 ./prioritized_dashboard_creation.sh > ~/cron.log 2>&1
# Run daily at 5pm EST (17:00 EST, 21:00 UTC)
# 00 21 * * * cd ~/big_data && RUN_FRIENDSHIPS=0 ./prioritized_dashboard_creation.sh > ~/cron.log 2>&1

#------------------------------------------------------------------------------------------------------------------------------------------------------------------------
#------------------------------------------------------- Run Remote MapReduce -------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# NB: not running these in parallel to keep overall system load minimal

if [ $RUN_FRIENDSHIPS == 1 ]
  then
    # Roll -> Friendships (produces gt-roll-frame/mr__friendships)
    echo ">>>MR Roll -> Friendships ..."
    mongo gt-db-roll-frame-s0-a/gt-roll-frame -u 'gt_user' -p 'GT/us3r!!!' ~/big_data/mr_roll.js
  else
    echo ">>>Skiped MR Roll -> Friendships!"
fi
# UserAction -> VideoActions (produces gt-user-action/mr__video_actions)
echo ">>>MR UserAction -> VideoAction ..."
mongo gt-db-user-action-s0-b/gt-user-action -u 'gt_user' -p 'GT/us3r!!!' ~/big_data/mr_user_action.js
# DashboardEntry -> VideoDashboardActions (produces gt-dashboard-entry/mr__video_dashboard_actions)
echo ">>>MR DashboardEntry -> VideoDashboardActions ..."
mongo gt-db-dashboard-s0-a/gt-dashboard-entry -u 'gt_user' -p 'GT/us3r!!!' ~/big_data/mr_dashboard_entry.js


#------------------------------------------------------------------------------------------------------------------------------------------------------------------------
#------------------------------------------------------- Collect Raw MR Results -----------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------------------------------------------------------------------------------

echo ">>>Remote dump gt-roll-frame/mr__friendships ..."
mongodump --host gt-db-roll-frame-s0-a -u 'gt_user' -p 'GT/us3r!!!' --db 'gt-roll-frame' --collection 'mr__friendships' --out ~/dump
echo ">>>Remote dump gt-user-action/mr__video_actions ..."
mongodump --host gt-db-user-action-s0-b -u 'gt_user' -p 'GT/us3r!!!' --db 'gt-user-action' --collection 'mr__video_actions' --out ~/dump
echo ">>>Remote dump gt-dashboard-entry/mr__video_dashboard_actions ..."
mongodump --host gt-db-dashboard-s0-a -u 'gt_user' -p 'GT/us3r!!!' --db 'gt-dashboard-entry' --collection 'mr__video_dashboard_actions' --out ~/dump

echo ">>>Local restore/replace gt-roll-frame/mr__friendships ..."
mongorestore -u 'gt_user' -p 'GT/us3r!!!' --db 'gt-prioritized-dashboard' --drop ~/dump/gt-roll-frame
echo ">>>Local restore/replace gt-user-action/mr__video_actions ..."
mongorestore -u 'gt_user' -p 'GT/us3r!!!' --db 'gt-prioritized-dashboard' --drop ~/dump/gt-user-action
echo ">>>Local restore/replace gt-dashboard-entry/mr__video_dashboard_actions ..."
mongorestore -u 'gt_user' -p 'GT/us3r!!!' --db 'gt-prioritized-dashboard' --drop ~/dump/gt-dashboard-entry



#------------------------------------------------------------------------------------------------------------------------------------------------------------------------
#------------------------------------------------------- Create Prioritized Dashboard -----------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Merges mr__video_dashboard_actions into mr__video_actions
# Then unwinds mr__video_actions to produce a single document per user which need to be individually processed
echo ">>>Local MR mr__video_dashboard_actions -> mr__video_actions & unwinding ..."
mongo localhost/gt-prioritized-dashboard -u 'gt_user' -p 'GT/us3r!!!' ~/big_data/mr_prioritized_dashboard_intermediary.js

# Process each document (1 doc per user) from mr__prioritized_dashboard_collated
# to create PrioritizedDashboardEntry (just a DashboardEntry enhanced with a score and reason "why" it's important)
echo ">>>Reset temporary PrioritizedDashboard ..."
mongo localhost/gt-prioritized-dashboard -u 'gt_user' -p 'GT/us3r!!!' ~/big_data/reset_side_prioritized_dashboard.js
echo ">>>Create temporary PrioritizedDashbaord (4 concurrent processes) ..."
mongo localhost/gt-prioritized-dashboard -u 'gt_user' -p 'GT/us3r!!!' ~/big_data/generate_side_prioritized_dashboard.js &
mongo localhost/gt-prioritized-dashboard -u 'gt_user' -p 'GT/us3r!!!' ~/big_data/generate_side_prioritized_dashboard.js &
mongo localhost/gt-prioritized-dashboard -u 'gt_user' -p 'GT/us3r!!!' ~/big_data/generate_side_prioritized_dashboard.js &
mongo localhost/gt-prioritized-dashboard -u 'gt_user' -p 'GT/us3r!!!' ~/big_data/generate_side_prioritized_dashboard.js &
# Wait for all of the above to complete (fine to do even when it's only one and it's not backgrounded)
wait
# Update the production queryable PrioritizedDashboard collection
echo ">>>Swap temporary side_prioritized_dashboard to prioritized_dashboard_entries ..."
mongo localhost/admin -u 'gt_user' -p 'GT/us3r!!!' ~/big_data/atomic_update_prioritized_dashboard.js
echo ">>>Done!"

