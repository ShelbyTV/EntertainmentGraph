# Entertainment Graph


## Overview

The Shelby database has a lot of valuable data. Code contained in this repository aims to process that data into a usable form.

Currently the main production usage is prioritizing a user's stream based on recent social actions primarily contained in the UserAction database.  This is done with several incremental MapReduce operations and a final user-specific prioritization step.

A user's prioritized dashboard is generated periodically in the background which means it is not real time and generally does not represent the most up to date information in a user's stream.  It must be used accordingly by the front ends.


## Code

All of the code is in script form and needs no compiling.  The scripts in `src/big_data` with an `mr_` prefix indicate MongoDB MapReduce scripts.  The other `src/big_data` scripts transform collections directly.  There is also a control script to orchestrate the process (convenient for periodic background processing via cron).

### Running

The control script (`src/prioritized_dashboard_creation.sh`) assumes it is running on a machine with remote access to several databases (gt-db-user-action-s0-b, gt-db-dashboard-s0-a, gt-db-roll-frame-s0-c) and local access to a MongoDB that will hold the end product.  The `mr_` scripts should be run directly on the MongoDB primary (as done by the control script).

Control script currently run by `cron` on `gt-db-prioritized-dashboard-s0-a`

### Caveats

The hard-coded database names in `src/prioritized_dashboard_creation.sh` need to point to the current primary in their respective replica set.  Ideally, we would point to any member (or multiple members) in the replica set and the executing script would ensure it's running on the primary.


## Productizing

Nodes in the Entertainment Graph graph (`gt-prioritized-dashboard/mr__video_actions`) are users and videos.  An edge exists between user U and video V if U has taken any actions on V.  Such actions include sharing (anything visible to Shelby, on- or off-network), liking, rolling, watching, and receiving (ie. V was shared with U by a different user).  Edges have no inherent score, but weighing the edges is a useful concept when applying the data contained in this graph.

It's what we produce with the Entertainment Graph, not the graph itself, that is interesting...

### Prioritized Dashboard

By differently weighing each edge between a user U and a video V we determine a score for V.  The user's dashboard, each entry pointing to a video, can then be rank-ordered using these scores.  Additional data (ie. has U already watched V?) may be incorporated by the front ends to filter and/or adjust the rank ordering.

### Personal Primetime

Periodic notifications (ie. email, iOS push notifications) may also be sent to a user.  These may call out videos which the user is more likely to have interest in because of other users -- friends -- that have taken actions on the video.  The notification can mention the friends by name, thus increasing conversion.  The notification opens a portion of high-scoring Prioritized Dashboard Entries which can be branded as a unit on a regular schedule: Personal Primetime.

