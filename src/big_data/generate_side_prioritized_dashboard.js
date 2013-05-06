//------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------- Filter, Score, Break-out each Dashboard Entry ------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/* Timing */
var start = new Date();
print("generate_side_prioritized_dashboard.js -- Starting at "+start);
/* End Timing */

//
// Goal of this script is to process the collated documents in mr__prioritized_dashboard_collated
// for all users and dump the results into a temporary collection (which will be atomically swapped in)
//

// Helpers...
var unionOfStringArrays = function(arr1, arr2){
  var union = [], curObj;
  for(var i = 0; i < arr1.length; i++){
    curObj = arr1[i];
    //NB: native indexOf() is 30x faster than a custom indexOf() using .equals()
    // therefore, we store strings (instead of ObjectId) earlier in the MapReduce process
    if(arr2.indexOf(curObj) > -1){
      union.push(curObj);
    }
  }
  return union;
};

//no longer used, potentially useful helper
var uniqueCount = function(arr){
  var objs = {};
  for(var i = 0; i < arr.length; i++){
    objs[arr[i]] = 1;
  }
  return Object.keys(objs).length;
};

var likeWeight = 20;      //shelby likes          - a8
var rollWeight = 30;      //shelby shares         - a9
var posterWeight = 5;     //non-shelby shares     - b1
var viewWeight = 2;       //shelby views          - a1
var fullViewWeight = 15;  //shelby complete views - a11
var computeScore = function(prioritizedDashboardEntry){
  var score = 0;
  score += (prioritizedDashboardEntry.b1.length * posterWeight);
  score += (prioritizedDashboardEntry.a1.length * viewWeight);
  score += (prioritizedDashboardEntry.a8.length * likeWeight);
  score += (prioritizedDashboardEntry.a9.length * rollWeight);
  score += (prioritizedDashboardEntry.a11.length * fullViewWeight);
  return score;
};


var prioritizedDashboardCollatedCount = db.mr__prioritized_dashboard_collated.count();
var processed = 0, curPDBE, dbe, prioritizedDashboardEntry, usersFriends, usersFriendsStringArray, userId, i;
db.mr__prioritized_dashboard_collated.find({ lock:{$exists:false} }).forEach( function(collatedPDBE){
  
  //lock this document
  lockedPDBE = db.mr__prioritized_dashboard_collated.findAndModify({
    query: {_id:collatedPDBE._id, lock:{$exists:false}},
    update: {$inc:{lock:1}},
    new: true 
    });
  //abort if we couldn't obtain lock
  if(!lockedPDBE || lockedPDBE.lock != 1){
    processed++;
    //print("Skipping locked entry "+processed+"/"+prioritizedDashboardCollatedCount);
  } else {
  
    //make sure we have friends
    userId = collatedPDBE._id;
    usersFriends = db.mr__friendships.findOne({_id:userId});
    if(!usersFriends){
      processed++;
      //print("No friends ("+userId+"), skipping "+processed+"/"+prioritizedDashboardCollatedCount);
    } else {
      //user should not be considered a "friend" for the purposes of our calculations
      delete usersFriends.value[userId.valueOf()];
      usersFriendsStringArray = Object.keys(usersFriends.value);
  
      for(i = 0; i < collatedPDBE.value.x.length; i++){
        curPDBE = collatedPDBE.value.x[i];
        dbe = curPDBE.dbe;
        prioritizedDashboardEntry = {};
    
        //===Non-Standard Dashboard Entry Data===
        prioritizedDashboardEntry.dbe_id = dbe.id;  //the original dashboard entry id itself
        prioritizedDashboardEntry.watched_by_owner = (curPDBE.a1.indexOf(userId.valueOf()) > -1);
        prioritizedDashboardEntry.rolled_by_owner = (curPDBE.a9.indexOf(userId.valueOf()) > -1);
        //filter posters (b1) to just users friends (does not include user)
        prioritizedDashboardEntry.b1 = unionOfStringArrays(Object.keys(curPDBE.b1), usersFriendsStringArray);
        //filter viewers (a1), likers (a8), rollers (a9), and complete viewers (a11) to just user's friends
        prioritizedDashboardEntry.a1 = unionOfStringArrays(curPDBE.a1, usersFriendsStringArray);
        prioritizedDashboardEntry.a8 = unionOfStringArrays(curPDBE.a8, usersFriendsStringArray);
        prioritizedDashboardEntry.a9 = unionOfStringArrays(curPDBE.a9, usersFriendsStringArray);
        prioritizedDashboardEntry.a11 = unionOfStringArrays(curPDBE.a11, usersFriendsStringArray);
    
        //compute score
        prioritizedDashboardEntry.score = computeScore(prioritizedDashboardEntry);
    
        //===Standard Dashboard Entry Data===
        prioritizedDashboardEntry.a = userId;     // a - user_id
        prioritizedDashboardEntry.b = dbe.b;      // b - roll_id
        prioritizedDashboardEntry.c = dbe.c;      // c - frame_id
        prioritizedDashboardEntry.d = prioritizedDashboardEntry.watched_by_owner; // d - read (ie. watched by owner)
        prioritizedDashboardEntry.e = 30;         // e - action ("prioritized_frame")
        prioritizedDashboardEntry.f = dbe.f;      // f - actor_id
        prioritizedDashboardEntry.g = curPDBE.g;  // g - video_id
    
        db.side_prioritized_dashboard.insert(prioritizedDashboardEntry);
      }
  
      processed++;
      //print("Processed "+processed+"/"+prioritizedDashboardCollatedCount);
    }
  }

});

/* Timing */
var end = new Date();
var dur = end-start;
print("generate_side_prioritized_dashboard.js -- Completed at "+end);
print("generate_side_prioritized_dashboard.js -- Duration: "+dur/60000+"m   [Processed "+(prioritizedDashboardCollatedCount/(dur/1000))+" records / s]");
/* End Timing */


//next, once all documents are in the side collection, they are atomically swapped with the previous production queryable collection

