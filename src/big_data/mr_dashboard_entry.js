//------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------MR DashboardEntries -> VideoDashboardActions --------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/* Timing */
var start = new Date();
print("mr_dashboard_entry.js -- Starting at "+start);
/* End Timing */

// Goal of this Map Reduce:
//  For a given video_id, end up with an object tracking
//   1) all posters of this video (they will be faux and real, with overlap of the rollers in MRVideoActions) -- b1
//      *** important that the faux posters are in here, b/c THEY ARE NOT in the friendships map ***
//   2) all potential viewers of this video (via the oldest dashboard entry we have of it) -- b2


// Example mapping from a single DashboardEntry:
//  Key = <VIDEO_ID>
//  Value = { b1 : { <ACTOR_ID_STR> : 1 },
//            b2 : { <VIEWER_ID_STR> : { id: <DASHBOARD_ENTRY_ID>,
//                                        b: <ROLL_ID>,
//                                        c: <FRAME_ID>,
//                                        f: <ACTOR_ID> }
//                 }
//          }
var mapDashboardEntries = function(){
  // DashboardEntry.a stores user_id (of viewer)
  // DashboardEntry.g stores video_id
  // DashboardEntry.f stores user_id (of actor)
  if(this.a && this.g && this.f){
    var value = {
      b1: {},
      b2: {}
    };
    
    value.b1[this.f] = 1;
    value.b2[this.a] = {
      id: this._id,
      b: this.b, //roll_id
      c: this.c, //frame_id
      f: this.f, //actor_id
    };
  
    emit(this.g, value);
  }
};


// Reduce fakes set semantics of viewers and actors by storing them in objects.
// Otherwise (ie. using arrays) we would have many duplicate entries in b1 and b2
// b/c each tweet creates many DashboardEntrys
//
// Example reduce:
//  Key = <VIDEO_ID>
//  Value = { b1: {U1:1, U2:1, U3:1, ...},
//            b2: {U5:{id:<DASHBOARD_ENTRY_ID>, b:<ROLL_ID>, c:<FRAME_ID>, f:<ACTOR_ID>}, U6:{...}, U7:{...}, ...}
//          }
var reduceDashboardEntries = function(videoId, values){
  var reducedValue = {
    b1: {},
    b2: {}
  },
  key;
  
  for(var i = 0; i < values.length; i++){
    for(key in values[i].b1){
      reducedValue.b1[key] = values[i].b1[key];
    }
    for(key in values[i].b2){
      reducedValue.b2[key] = values[i].b2[key];
    }
  }
  
  return reducedValue;
};


// Map Reduce
// NB: The limit used here is ~1.5x greater than the current count of matching documets
var daysAgoId = ObjectId((Math.floor((new Date())/1000) - 5*24*60*60).toString(16) + "0000000000000000");
db.dashboard_entries.mapReduce( mapDashboardEntries, reduceDashboardEntries, {
  query: {_id:{$gt: daysAgoId}},
  sort: {_id:1},
  limit: 10000000,
  out: {
    replace: 'mr__video_dashboard_actions'
  }
});


/* Timing */
var end = new Date();
var dur = end-start;
print("mr_dashboard_entry.js -- Completed at "+end);
print("mr_dashboard_entry.js -- Duration: "+dur/60000+"m");
/* End Timing */
