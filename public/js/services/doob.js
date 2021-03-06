define(['services/services', 'lib/doob', 'lib/audio', 'lib/io', 'lib/effects', 'lib/sequencer'], 
	function(services, _doob, _audio, _io, _effects, _sequencer){

	services.factory('doobio', 
	['socket', '$http', '$rootScope', '$q',
	function(socket, $http, $rootScope, $q) {

		var loadedAssets = {}, self = this, instances = {}, instanceNames = [];

		// doob unrelated messages...
		socket.on('user:notification', function(message){
			console.log('you have a new notification: %s', message);
		});

		socket.on('user:activity', function(message){
			console.log('New Activity: %s', message);
		});

		socket.on('user:broadcast:stop', function(message){
			if (message.broadcaster == $rootScope.username) return;
			if (instances[message.broadcaster]) 
				instances[message.broadcaster].isBroadcasting = false;
		});

		socket.on('sync:request', function(message){
			console.log('sync request received from %s to %s', 
				message.subscriber, message.broadcaster);

			// this is a bad sync request.
			if (message.subscriber == $rootScope.username || 
				message.broadcaster != $rootScope.username)
				return;

			if (!instances[message.broadcaster].isBroadcasting) return;

			emit("sync:response", {
				event: 'sync:response',
				broadcaster: message.broadcaster,
				subscriber: message.subscriber,
				doob: instances[message.broadcaster].env.exportables
			});
		});	

		socket.on('sync:response', function(message){
			console.log('sync response received: from %s to %s', 
				message.subscriber, message.broadcaster);

			// this is a bad sync request.
			if (message.subscriber != $rootScope.username || 
				message.broadcaster == $rootScope.username)
				return;

		});	
		
		// a new sound has been added, and is being broadcasted 'new:sequencer:SoundPattern'
		socket.on('set:sequencer:SoundPattern:id', function(message){

			console.log(message)

			if (message.broadcaster == $rootScope.username || 
				!instances[message.subscriber]) return;

			var sp = message.message;

			// the instance is already removed. just inform the server that the instance is gone.
			if (!instances[message.subscriber].env.assets[sp.pattern])
				return emit('remove:sequencer:SoundPattern', {
					event: 'remove:sequencer:SoundPattern',
					timestamp: new Date().getTime(),
					broadcaster: $rootScope.username,
					subscriber: message.subscriber,
					message: sp
				});

			var flag = message.broadcaster == 'sys' ? true : false;

			// instances[message.subscriber].env.assets[sp.pattern].setId(sp.id, flag);

			// create all the sounds in this sound pattern
			for (var sound in sp.tracks)
				new instances[message.broadcaster].audio.sound({
					name: sound.name, url: sound.url
				});	
			

		});

		socket.on('remove:sequencer:SoundPattern', function(message){


			if (message.broadcaster == $rootScope.username || 
				!instances[message.subscriber]) return;

			var sp = message.message;

			doobio.instances[message.subscriber].env.removeAsset(sp.name, sp.id);
			delete doobio.get(message.subscriber).soundPatterns[sp.name];

		});

		// a new sound has been added, and is being broadcasted 'new:sequencer:SoundPattern'
		socket.on('new:sequencer:SoundPattern', function(message){

			// TODO: LOGGING...
			// if the broadcaster is the same as this user, or if the broadcaster's instance 
			// has not yet been created, it's probably a wrong message.

			if (message.broadcaster == $rootScope.username || 
				!instances[message.broadcaster]) return;

			var sp = message.message;


			// create all the sounds in this sound pattern
			for (var sound in sp.tracks)
				new instances[message.broadcaster].audio.sound({
					name: sound.name, url: sound.url,
					id: sound.id ? sound.id : null
				});	
			
			new instances[message.broadcaster].soundPattern(message.message);

		});

		socket.on('update:sequencer:SoundPattern:toggleNote', function(message){

			// TODO LOGGING...
			// if the broadcaster is the same as this user, or if the broadcaster's instance 
			// has not yet been created, it's probably a wrong message.
			if (message.broadcaster == $rootScope.username || 
				!instances[message.subscriber]) return;

			instances[message.subscriber].env.assets[message.message.pattern].toggleNote(
				message.message.note, message.message.track);

		});

		socket.on('update:sequencer:SoundPattern:newTrack', function(message){

			// TODO LOGGING...
			// if the broadcaster is the same as this user, or if the broadcaster's instance 
			// has not yet been created, it's probably a wrong message.
			if (message.broadcaster == $rootScope.username || 
				!instances[message.subscriber]) return;
			
			instances[message.subscriber].env.assets[message.message.pattern].newTrack(message.message.track);

		});

		socket.on('update:sequencer:SoundPattern:removeTrack', function(message){

			// TODO LOGGING...

			// if the broadcaster is the same as this user, or if the broadcaster's instance 
			// has not yet been created, it's probably a wrong message.
			if (message.broadcaster == $rootScope.username || 
				!instances[message.subscriber]) return;
			
			instances[message.subscriber].env.assets[message.message.pattern].removeTrack(message.message.track);

		});

		socket.on('update:sequencer:SoundPattern:changeTempo', function(message){

			if (message.broadcaster == $rootScope.username || 
				!instances[message.subscriber]) return;
			console.log(message)
			instances[message.subscriber].env.ids[message.message.id].changeTempo(message.message.tempo);

		});

		socket.on('update:sequencer:SoundPattern:changeSteps', function(message){

			if (message.broadcaster == $rootScope.username || 
				!instances[message.subscriber]) return;
			
			instances[message.subscriber].env.ids[message.message.id].changeSteps(message.message.steps);

		});

		// a new sound has been added, and is being broadcasted
		socket.on('new:aduio:Sound', function(message){
			console.log(message)
			// TODO: LOGGING...
			// if the broadcaster is the same as this user, or if the broadcaster's instance 
			// has not yet been created, it's probably a wrong message.
			if (message.broadcaster == $rootScope.username || 
				!instances[message.broadcaster]) return;

			var s = message.message;

			// TODO: check the message.
			if (message.broadcaster == $rootScope.username) return;

			var sound = {
				name: s.name,
				url: s.url,
				gainName: s.gain.name,
				graphName: s.graph.name,
				id: s.id ? s.id : null
			};
			
			
			new instances[message.broadcaster].audio.Sound(sound);

		});

		socket.on('user:broadcast:start', function(message){

			console.log(message)

			if (message.broadcaster == $rootScope.username) return;
			
			if (instances[message.broadcaster]) {
				instances[message.broadcaster].isBroadcasting = true;
				// TODO: send a sync request
			}
			else
			{
				new doob(message.broadcaster);
				instances[message.broadcaster].isBroadcasting = true;
			}

		});		
		
		var emit = function(event, message) {

			if (!message.timestamp) message.timestamp = new Date().getTime();
			if (!message.event) message.event = event;

			socket.emit(event, message);
		};

		var regenerate = function(message) {

			if (!message.doob || !message.broadcaster) return;
			var d = message.doob;
			var re_d = instances[message.broadcaster] || new doob(message.broadcaster);
			instances[message.broadcaster].isBroadcasting = true;			

			// load reverbs
			for (var i in d.independents.effects.reverbs) {
				console.log(d.independents.effects.reverbs[i].impulse)
				var t = new re_d.effects.Reverb({
					name: d.independents.effects.reverbs[i].name,
					graphName: d.independents.effects.reverbs[i].graphName,
					impulse: d.independents.effects.reverbs[i].impulse,
					id: d.independents.effects.reverbs[i].id || null,
				});
				
			}

			// load sounds
			for (var i in d.independents.sounds)
				new re_d.audio.Sound({
					name: d.independents.sounds[i].name,
					url: d.independents.sounds[i].url,
					graphName: d.independents.sounds[i].graphName,
					gainName: d.independents.sounds[i].gainName,
					id: d.independents.sounds[i].id || null,
				});

			// load routes
			for (var i in d.dependents.graphs)
				if (d.dependents.graphs[i].sendingNodes.length > 0) {
					var holder = d.dependents.graphs[i].belongsTo;
					for (var j = 0; j < d.dependents.graphs[i].sendingNodes.length; ++j) {
						var sendingNode = d.dependents.graphs[i].sendingNodes[j];
						
						re_d.env.assets[holder].graph.addSend(re_d.env.assets[sendingNode]);
					}
				}


			// load soundPatterns
			for (var i in d.independents.sequencers.soundPatterns) {
				var sp = {
					name: d.independents.sequencers.soundPatterns[i].name,
					tempo: d.independents.sequencers.soundPatterns[i].tempo,
					bars: d.independents.sequencers.soundPatterns[i].bars,
					steps: d.independents.sequencers.soundPatterns[i].steps,
					tracks: d.independents.sequencers.soundPatterns[i].tracks,
					id: d.independents.sequencers.soundPatterns[i].id || null,
				};
				
				new re_d.sequencer.SoundPattern(sp);
			}

		}

		var loadBuffer = function(config, callback) {
        	var self = this;
	        if (!config.url) throw 'loadBuffer : Invalid arguments';
	        if (loadedAssets[config.url]) {
	            if (config.load && typeof config.load === 'function') 
	                config.load(loadedAssets[config.url]);

	            if (callback) return callback(loadedAssets[config.url]);
	            return;
	        }

	        var request = new XMLHttpRequest();

	        request.open('GET', config.url, true);
	        request.responseType = 'arraybuffer';

	        request.onload = function() {
	           

	            if (config.loading && typeof config.loading === 'function') config.loading();

	            	instances[instanceNames[0]].env.context.decodeAudioData(request.response, 
	            	function(buffer){


	                loadedAssets[config.url] = buffer;

	                if (config.load && typeof config.load === 'function') 
	                	return config.load(buffer);

	                if (callback) return callback(buffer);
	                
	            });
	        };
	        request.send();
	    }

		var handlers = {
			doob: {
				sync: function(ev, exportable) {
					$http({
						method: 'post',
						url: '/project',
						headers: {
							'Content-Type': 'application/json'
						},
						data: JSON.stringify(exportable)
					}).success(function(){
						console.log('/project SUCCEED!');
					}).error(function(){
						console.log('/project ERROR!');
					});
				}
			},
			audio: {
				'new:aduio:Sound': function(ev, exportable, name) {
					
					emit(ev, {
						event: ev,
						broadcaster: $rootScope.username,
						subscriber: name,
						message: exportable
					});
				}
			},
			sequencer: {
                'update:sequencer:SoundPattern:changeTempo': function(ev, message, name){
                	emit(ev, {
                		event: ev,
                		broadcaster: $rootScope.username,
                		subscriber: name,
                		message: message
					});
                },
                'update:sequencer:SoundPattern:changeSteps': function(ev, message, name){
                	emit(ev, {
                		event: ev,
                		broadcaster: $rootScope.username,
                		subscriber: name,
                		message: message
					});
                },
                'set:sequencer:SoundPattern:id': function(ev, message, name) {

					emit(ev, {
						event: ev,
						broadcaster: $rootScope.username,
						subscriber: name,
						message: message
					});

                }, 
				"remove:sequencer:SoundPattern": function(ev, message, name) {
					emit(ev, {
						event: ev,
						broadcaster: $rootScope.username,
						subscriber: name,
						message: message
					});
				}
            }
		}
		
		var attachID = function (resource, doob, callback) {

			$http.get('/id').success(function(id){
				doob.env.assets[resource.name].id = id;
				doob.env.ids[id] = doob.env.assets[resource.name];
				if (callback) callback(null);
				
			}).error(function(data, status){
				if (callback) callback(data); 
				console.log(status);
			});
		}
        

    	function doob(name) {
    		var self = this;
    		this.name = name;
    		this.patterns = {};
    		this.isAlien = name == $rootScope.username ? false : true;
    		this.isBroadcasting = false;
    		this.isListening = false;
    		this.sounds = [];
    		this.env = new _doob(name);
    		this.env.loadBuffer = loadBuffer;
    		this.io = _io(this.env);
    		this.audio = _audio(this.env, this.io);
    		this.effects = _effects(this.env, this.io);
    		this.sequencer = _sequencer(this.env, this.io, this.audio);

    		this.sound = function(sound, pub) {
    			
    			sound = self.audio.Sound(sound, pub);
    			if (!sound.id) attachID(self.env.assets[sound.name], self);
    			
    			return self.env.assets[sound.name];
    		};

    		this.soundPattern = function(sp, pub) {

    			var delay = $q.defer();

    			sp = self.sequencer.SoundPattern(sp);

    			if (!sp.id) attachID(self.env.assets[sp.name], self, function(error){
    				if (!error) _createPatternInfo();
    				else delay.reject(error);
    			});
    			else _createPatternInfo();

    			function _createPatternInfo() {

    				self.patterns[sp.id] = {
						_id: sp.id,
    					name: sp.name,
    					username: $rootScope.username,
    					created: new Date().getTime(),
    					updated: new Date().getTime(),
    					content: sp,								
						comments: [],
						likesCount: 0
    				}

    				delay.resolve(self.patterns[sp.id]);

					emit('new:sequencer:SoundPattern', {
						event: 'new:sequencer:SoundPattern',
						broadcaster: $rootScope.username,
						timestamp: self.patterns[sp.id].created,
						subscriber: $rootScope.username,
						message: sp.exportable()
					});
    			}

    			return delay.promise;
    		};

    		this.forkPattern = function (_sp) {

    			var delay = $q.defer();

    			sp = self.sequencer.SoundPattern(_sp.content);

				self.patterns[sp.id] = {
					_id: sp.id,
					name: _sp.name,
					forkedFrom: _sp.forkedFrom,
					isForked: true,
					created: new Date().getTime(),
					updated: new Date().getTime(),
					content: sp,								
					comments: [],
					likesCount: 0,
					username: $rootScope.username,
				}

				delay.resolve(self.patterns[sp.id]);

				console.log(self.patterns[sp.id])

				emit('fork:sequencer:SoundPattern', {
					event: 'fork:sequencer:SoundPattern',
					broadcaster: $rootScope.username,
					timestamp: self.patterns[sp.id].created,
					subscriber: $rootScope.username,
					forkedFrom: self.patterns[sp.id].forkedFrom,
					message: {
						content: sp.exportable()
					}
				});
    			

    			return delay.promise;
    		};

    		this.effect = function(fx, pub) {
    			fx = self.effects.Reverb(fx, pub);
    			if (!fx.id) attachID(self.env.assets[fx.name], self);

    			return self.env.assets[fx.name];
    		};

    		this.newTrack = function(sound, pid, updated, pub) {

    			var delay = $q.defer();

				var promise = requestID();

				promise.then(function (id) {
					self.env.ids[pid].newTrack(sound, id, true);
					delay.resolve();
					
					self.patterns[pid].updated = updated;

					var tracks = {};

					for (var i in self.patterns[pid].content.tracks) {
						tracks[i] = {};
                        for (var j in self.patterns[pid].content.tracks[i]) {
                            if (j.indexOf("$") == -1) {
                                tracks[i][j] = self.patterns[pid].content.tracks[i][j];
                            }
                        }
					}

					if (pub)
	                    emit('update:sequencer:SoundPattern:newTrack', {
	                    	broadcaster: $rootScope.username,
							subscriber: self.name,
		                    timestamp: updated,
	                        message: {
		                        id: pid,
		                        tracks: tracks,
		                    }
	                    });

				}, function (error) {
					delay.reject(error);
				});

				return delay.promise;
    		};

    		this.removeTrack = function(trackid, pid, updated, pub) {

    			self.env.ids[pid].removeTrack(trackid);

    			self.patterns[pid].updated = updated;

				var tracks = {};

				for (var i in self.patterns[pid].content.tracks) {
					tracks[i] = {};
                    for (var j in self.patterns[pid].content.tracks[i]) {
                        if (j.indexOf("$") == -1) {
                            tracks[i][j] = self.patterns[pid].content.tracks[i][j];
                        }
                    }
				}

				if (pub)
                    emit('update:sequencer:SoundPattern:removeTrack', {
                    	broadcaster: $rootScope.username,
						subscriber: self.name,
	                    timestamp: updated,
                        message: {
	                        id: pid,
	                        tracks: tracks,
	                    }
                    });
    		
    		};

    		this.toggleNote = function(i, trackid, pid, updated, pub) {
    			
    			self.env.ids[pid].toggleNote(i, trackid);

    			self.patterns[pid].updated = updated;

				var tracks = {};

				for (var i in self.patterns[pid].content.tracks) {
					tracks[i] = {};
                    for (var j in self.patterns[pid].content.tracks[i]) {
                        if (j.indexOf("$") == -1) {
                            tracks[i][j] = self.patterns[pid].content.tracks[i][j];
                        }
                    }
				}

				if (pub)
                    emit('update:sequencer:SoundPattern:removeTrack', {
                    	broadcaster: $rootScope.username,
						subscriber: self.name,
	                    timestamp: updated,
                        message: {
	                        id: pid,
	                        tracks: tracks,
	                    }
                    });
    		};

    		// subscribe doobio to all events of this doob
    		for (var i in handlers) 
    			for (var j in this.env.handlers[i])
    				if (handlers[i][j])
    					this.env.subscribe(j, handlers[i][j]);

    		// subscribe this doob to all events of this doob's audio, io, effects, etc events
    		for (var i in this.env.handlers) 
    			for (var j in this.env.handlers[i])
    				if (this.env.handlers[i][j])
    					this[i].subscribe(j, this.env.handlers[i][j]);

    		instances[name] = this;
    		instanceNames.push(this.name);
    	}

    	var requestID = function() {
			var delay = $q.defer();

			$http.get('/id').success(function(id){
				delay.resolve(id);
			}).error(function(data){
				delay.reject(data);
			});

			return delay.promise;
		};
    	
		return {
			get: function(name){
				return instances[name] ? instances[name].env : null;
			}, 
			instances: instances,
			instanceNames: instanceNames,
			broadcast: function(e, name) {
				var obj = {
					'username': name,
					'doob': {
						assets: instances[name].env.assetsToJSON,
						sounds: instances[name].env.sounds,
						soundPatterns: instances[name].env.soundPatterns,
						dummyNodes: instances[name].env.dummyNodes
					}
				};
				socket.emit('user:broadcast:entire:session', obj);
			},
			create: function(name){
				if (!name) return null;
				if (instances[name]) return instances[name].env;
				return new doob(name);
			},
			playInline: function(instance, sound) {

				if (typeof instance == 'string') {

					_audio(instances[instance].env).playSound({
							buffer: instances[instance].env.assets[sound].buffer,
							graph: instances[instance].env.assets[sound].graph
					});
					
				}
				else if (sound.url) {
					loadBuffer(sound, function(buffer){
						instances[$rootScope.username].audio.playSound({
							buffer: buffer,
							destination: instances[$rootScope.username].env.masterGain
						});
					});
				}
			},
			get sounds() {

				var s = new Array();

				for (var i in instances) {
					s = s.concat(instances[i].env.sounds);
				}
				return s;
			}, 
			get soundPatterns() {

				var s = new Array();

				for (var i in instances) {
					s = s.concat(instances[i].env.soundPatternsArray);
				}
				return s;
			},
			audio: function(name) {
				
				if (!name) return;

				if (typeof name == 'string')
					return instances[name].audio;

				return;
			},
			effects: function(name) {
 
 				if (!name) return;

				if (typeof name == 'string')
					return instances[name].effects;

				return;
			},
			sequencer: function(name) {
 
 				if (!name) return;

				if (typeof name == 'string')
					return instances[name].sequencer;

				return;
			},
			toggleBroadcast: function(name) {

				if (!name) return;
				if(instances[name].isBroadcasting) {
					instances[name].isBroadcasting = false;
					emit("user:broadcast:stop", {
						event: 'user:broadcast:stop',
						broadcaster: $rootScope.username,
						subscriber: name
					});
				}
				else {
					instances[name].isBroadcasting = true;
					emit("user:broadcast:start", {
						event: 'user:broadcast:start',
						broadcaster: $rootScope.username,
						subscriber: name,
						doob: instances[name].env.exportables
					});	
				}
			},
			requestID: requestID
		};
	}]);
	
});