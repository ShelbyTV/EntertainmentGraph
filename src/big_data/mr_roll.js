//------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------- MR Rolls -> Friendships ----------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/* Timing */
var start = new Date();
print("mr_roll.js -- Starting at "+start);
/* End Timing */

// Goal of this Map Reduce:
//  For a given user_id, produce a set of friends (ie. creators of rolls followed by user)
//  NB: We do not need "faux" relationships (b/c faux users only action will result in a dashboard entry, which we capture separately)

// Example mapping from each following_user entry in a Roll
//  Key = <USER_ID>
//  Value = { <FRIEND_ID_STR>:1 }
var mapRolls = function(){
  // Roll.a stores roll's creator's user_id (our value)
  // Roll.following_users stores the embedded following users document which stores
  //  following_user.a stores the following user's user_id (our key)
  
  if(this.following_users){
    for(var i = 0; i < this.following_users.length; i++){
      var value = {};
      value[this.a] = 1;
      emit(this.following_users[i].a, value);
    }
  }
};

// Reduce fakes set semantics of friends by storing them in objects.
// Example reduce:
//  Key = <USER_ID>
//  Value = { Friend1:1, Friend2:1, Friend3:1, ...}
var reduceRolls = function(userId, values){
  var reducedValue = {},
  key;
  
  for(var i = 0; i < values.length; i++){
    for(key in values[i]){
      reducedValue[key] = 1;
    }
  }
  
  return reducedValue;
};


// NB: This MR doesn't seem to kill performance, but should be run off peak.
//  It's the most expensive thing we're running for EG/PP...
//  Seeing increase in lock & page faults on primary when running this
db.rolls.mapReduce( mapRolls, reduceRolls, {
  /// Not looking at faux rolls as we only care about "real" friendships
  query: {n:{$nin:[11,12,13,14]}},
  out: {
    replace: 'mr__friendships'
  }
});


/* Timing */
var end = new Date();
var dur = end-start;
print("mr_roll.js -- Completed at "+end);
print("mr_roll.js -- Duration: "+dur/60000+"m");
/* End Timing */
