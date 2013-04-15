//------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------- Merge mr__video_actions & mr__video_dashboard_actions ----------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/* Timing */
var start = new Date();
print("mr_prioritized_dashboard_intermediary.js -- Starting at "+start);
/* End Timing */

// Goal of this Map Reduce:
//  For a given video_id, end up with an object tracking
//   1) all posters of this video via DashboardEntry (they will be faux and real, with overlap in a9) -- b1
//   2) all potential viewers of this video (via the oldest DashboardEntry we have of it) -- b2
//   3) all users that Viewed it -- a1
//   4) all users that Liked it -- a8
//   5) all users that Rolled it -- a9
//   6) all users that Viewed it completely -- a11

// we have b1, b2 in mr__video_dashboard_actions
//         a1, a8, a9, a11 in mr__video_actions
// So the map phase is pointless (just emitting the exact document from mr__video_dashboard_actions)
// In the reduce phase we just merge these things

var trivialMapper = function(){
  emit(this._id, this.value);
};

// Example reduce:
//  Key = <VIDEO_ID>
//  Value = { b1: {U1:1, U2:1, U3:1, ...},          <- all posters of this video (via DashboardEntry)
//            b2: {U1:                              <- all potential viewers of this video (via DashboardEntry)
//                    { id: <DASHBOARD_ENTRY_ID>,  
//                       b: <ROLL_ID>,
//                       c: <FRAME_ID>,
//                       f: <ACTOR_ID> }
//            a1:  [U1, U2, U3, U4, ...],           <- all users that viewed it
//            a8:  [U1, U9, ...],                   <- all users that liked it
//            a9:  [U1, U2, U11, U12, ...]          <- all users that rolled it (will have overlap with users of b1)
//            a11: [U1, U3, U9, ...] }              <- all users that viewed it completely
var reducerMerger = function(videoId, values){
  var reducedValue = {
    a1:  [],
    a8:  [],
    a9:  [],
    a11: [],
    b1:  {},
    b2:  {}
  },
  key;
  
  //values is either {a1:[], a8:[], a9:[], a11:[]} or {b1:{}, b2:{}} or {a1:[], a8:[], a9:[], a11:[], b1:{}, b2:{}}
  for(var i = 0; i < values.length; i++){
    if(values[i].hasOwnProperty('a1')){
      reducedValue.a1 = reducedValue.a1.concat(values[i].a1);
      reducedValue.a8 = reducedValue.a8.concat(values[i].a8);
      reducedValue.a9 = reducedValue.a9.concat(values[i].a9);
      reducedValue.a11 = reducedValue.a11.concat(values[i].a11);
    }
    if(values[i].hasOwnProperty('b1')){
      for(key in values[i].b1){
        reducedValue.b1[key] = values[i].b1[key];
      }
      for(key in values[i].b2){
        reducedValue.b2[key] = values[i].b2[key];
      }
    }
  }
  
  return reducedValue;
};

// NB: mongo output is kinda weird, will show "reduce:0" even though it's clearly merging the two collections
db.mr__video_dashboard_actions.mapReduce( trivialMapper, reducerMerger, {
  query: {},
  out: {
    reduce: 'mr__video_actions'
  }
});


//------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//---------------------------------------------------------Intermediary Prioritized Dashboard-----------------------------------------------------------------------------
//---------------------------------------------------------Collated in a single array per user----------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// Goal of this MapReduce:
// For a given user, end up with a single document holding an array of DashboardEntries + addtional info.
// The additional info are all the known Shelby actions taken on the referenced video.

//produce a new document for each user/dashboard entry pair in the b2 array
var unwindingMapper = function(){
  var userIdString;
  for(userIdString in this.value.b2){
    emit(ObjectId(userIdString), {x:{
      a1  : this.value.a1,
      a8  : this.value.a8,
      a9  : this.value.a9,
      a11 : this.value.a11,
      b1  : this.value.b1,
      dbe : this.value.b2[userIdString],
      g   : this._id
    }});
  }
};

//reduce down to one document per user, holding an array of the dashboard entries
// Example reduce:
//  Key = <USER_ID>
//  Value = {x:[{a1:  [U1, U2, U3, U4, ...],        <- all users that viewed it
//               a8:  [U1, U9, ...],                <- all users that liked it
//               a9:  [U1, U2, U11, U12, ...],      <- all users that rolled it (will have overlap with users of b1)
//               a11: [U1, U3, U9, ...],            <- all users that viewed it completely
//               b1: {U1:1, U2:1, U3:1, ...},       <- all posters of this video (via DashboardEntry)
//               dbe: { id: <DASHBOARD_ENTRY_ID>,  
//                       b: <ROLL_ID>,
//                       c: <FRAME_ID>,
//                       f: <ACTOR_ID> }
//               g: <VIDEO_ID> }, 
//              {...}, 
//              {...}, ...
//             ]
//          }
var collatorReducer = function(userId, values){
  var reducedValue = {x:[]};
  for(var i = 0; i < values.length; i++){
    reducedValue.x = reducedValue.x.concat(values[i].x);
  }
  return reducedValue;
};


db.mr__video_actions.mapReduce( unwindingMapper, collatorReducer, {
  //query = the usable subset of the re-reduced collection from above
  query: { "value.a1": {$exists:true}, "value.b2": {$exists:true} },
  out: {
    replace: 'mr__prioritized_dashboard_collated'
  }
});

//next processed locally by generate_side_prioritized_dashboard.js

/* Timing */
var end = new Date();
var dur = end-start;
print("mr_prioritized_dashboard_intermediary.js -- Completed at "+end);
print("mr_prioritized_dashboard_intermediary.js -- Duration: "+dur/60000+"m");
/* End Timing */
