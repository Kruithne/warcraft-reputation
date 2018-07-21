$(function() {
	var isPerformingLookup = false;
	var characterReputations = null;
	var characterData = null;
	var rosterData = null;

	var standingTypes = {
		basic: {
			stages: [
				36000, // Hated
				3000, // Hostile
				3000, // Unfriendly
				3000, // Neutral
				6000, // Friendly
				12000, // Honored
				21000 // Revered
			],

			ranks: {
				0: 'Hated',
				36000: 'Hostile',
				39000: 'Unfriendly',
				42000: 'Neutral',
				45000: 'Friendly',
				51000: 'Honored',
				63000: 'Revered',
				84000: 'Exalted'
			},

			default: {
				standing: 3,
				value: 0
			}
		},

		bodyguard: {
			stages: [
				0,
				0,
				0,
				3000,
				6000,
				11000
			],

			ranks:  {
				0: 'Bodyguard',
				10000: 'Wingman',
				20000: 'Personal Wingman'
			},

			default: {
				standing: 3,
				value: 0
			},

			maxStanding: 5,
			maxStandingValue: 11000
		},

		friend: {
			stages: [
				8400, // Stranger
				8400, // Acquaintance
				8400, // Buddy
				8400, // Friend
				8400 // Good Friend
			],

			ranks: {
				0: 'Stranger',
				8400: 'Acquaintance',
				16800: 'Buddy',
				25200: 'Friend',
				33600: 'Good Friend',
				42000: 'Best Friend'
			},

			default: {
				standing: 0,
				value: 0
			}
		}
	};

	var reputationModifiers = [
		{
			"name": "Diplomacy",
			"desc": "Human Racial",
			"factor": 0.1,
			"icon": "inv_misc_note_02",
			"race": 1
		},
		{
			"name": "WHEE!",
			"desc": "Darkmoon Faire",
			"factor": 0.1,
			"icon": "spell_misc_emotionhappy"
		},
		{
			"name": "Spirit of Sharing",
			"desc": "Harvest Festival",
			"factor": 0.1,
			"icon": "spell_holy_layonhands"
		},
		{
			"name": "Grim Visage",
			"desc": "Hallow's End",
			"factor": 0.1,
			"icon": "inv_mask_01"
		},
		{
			"name": "Banner of Cooperation",
			"desc": "Guild Vendor",
			"factor": 0.05,
			"icon": "inv_guild_standard_alliance_a",
			"restrict": "source-kill"
		},
		{
			"name": "Standard of Unity",
			"desc": "Guild Vendor",
			"factor": 0.1,
			"icon": "inv_guild_standard_alliance_b",
			"restrict": "source-kill"
		},
		{
			"name": "Battle Standard of Coordination",
			"desc": "Guild Vendor",
			"factor": 0.15,
			"icon": "inv_guild_standard_alliance_c",
			"restrict": "source-kill"
		},
		{
			"name": "Trading Pact",
			"desc": "Draenor Garrison Perk",
			"factor": 0.2,
			"icon": "achievement_reputation_01",
			"restrict": "source-draenor"
		}
	];

	var dynamicLinks = ['title', 'item', 'quest', 'achievement', 'npc', 'object', 'spell', 'mission'];

	$.fn.extend({
		createFrame: function(className) {
			var frame = $('<div/>').appendTo(this);
			if (typeof className === 'string')
				frame.addClass(className);
			
			return frame;
		}
	});

	var loadImage = function(url, callback) {
		$('<img/>').attr('src', url).one('load', function() {
			if (typeof(callback) === 'function')
				callback(url);
		}).each(function() {
			if (this.complete)
				$(this).trigger('load');
		});
	};

	var api = function(req, callback) {
		$.ajax({
			url: 'endpoint.php',
			type: 'POST',
			contentType: 'application/json',
			dataType: 'json',
			async: true,
			data: JSON.stringify(req),
			success: callback
		});
	};

	var background = $('#background');
	var statusElement = $('#status');
	var statusText = statusElement.find('span').first();
	var reputationDisplay = $('#reputation-display');

	var applyModifiers = function(value, filter) {
		var newValue = value;

		for (var i = 0; i < reputationModifiers.length; i++) {
			var modifier = reputationModifiers[i];

			if (modifier.active) {
				var restricted = typeof modifier.restrict !== 'undefined';

				if (restricted && typeof filter !== 'undefined') {
					var filters = filter.split(' ');
					if (filters.includes(modifier.restrict))
						restricted = false;
				}

				if (!restricted)
					newValue += value * modifier.factor;
			}
		}

		return Math.round(newValue * 10) / 10;
	};

	var setStatus = function(text) {
		statusText.text(text);
		return statusElement.removeClass('pending error').show().css('display', 'flex');
	};

	var setPendingStatus = function(text) {
		setStatus(text).addClass('pending');
	};

	var setErrorStatus = function(text) {
		setStatus(text).addClass('error');
	};

	var hideStatus = function() {
		statusElement.hide();
	};

	var clearReputations = function() {
		background.animate({ opacity: 0.5 }, 1000);
		reputationDisplay.empty();
	};

	var selectedRealm = null;

	var realmDropDown = $('#realm-drop');
	var realmField = $('#field-realm');
	var realmContainers = [];

	var characterField = $('#field-character');

	var selectOption = function(option) {
		selectedRealm = { region: option.attr('data-region'), realm: option.attr('data-slug') };
		realmField.val(option.text() + ' (' + selectedRealm.region.toUpperCase() + ')');
	};

	var hideRealmDropDown = function() {
		realmDropDown.hide();
		realmField.removeClass('activated');

		var filter = realmField.val().trim().toLowerCase();
		if (selectedRealm === null && filter.length > 0) {
			$('.realm-option').each(function() {
				var option = $(this);
				if (option.attr('data-name').startsWith(filter)) {
					selectOption(option);
					return false;
				}
			});
		}
	};

	var defaultValue = function(value, def) {
		if (typeof value !== 'undefined')
			return value;

		return def;
	};

	var showRealmDropDown = function(filter) {
		filter = filter.trim().toLowerCase();
		selectedRealm = null;

		if (filter.length > 0) {
			realmDropDown.show();
			realmField.addClass('activated');

			for (var i = 0; i < realmContainers.length; i++) {
				var realmContainer = realmContainers[i];
				var displayCount = 0;

				realmContainer.children('.realm-option').each(function() {
					var option = $(this);

					if (option.attr('data-name').startsWith(filter)) {
						option.show();
						displayCount++;
					} else {
						option.hide();
					}
				});

				displayCount > 0 ? realmContainer.show() : realmContainer.hide();
			}
		} else {
			hideRealmDropDown();
		}
	};

	var updateDynamicValues = function(guide) {
		guide.find('.step').each(function() {
			var step = $(this);
			var endStanding = parseInt(step.attr('data-standing-end'));
			var endStandingValue = parseInt(step.attr('data-standing-end-value'));

			var reputation = rosterData[parseInt(guide.attr('data-reputation-index'))];
			var playerState = characterReputations[reputation.id];

			// Update values to reflect modifiers.
			step.find('[data-value]').each(function() {
				var elem = $(this);
				elem.text(applyModifiers(parseFloat(elem.attr('data-value')), elem.attr('data-filter')));
			});

			if (playerState.standing < endStanding && (isNaN(endStandingValue) || playerState.value < endStandingValue)) {
				var stepNeededRep = parseInt(step.attr('data-rep-needed'));

				step.find('[data-total]').each(function() {
					var element = $(this);
					var value = applyModifiers(parseInt(element.attr('data-total')), element.attr('data-filter'));

					var calculated = Math.ceil(stepNeededRep / value);
					var text = element.attr('data-text');

					if (typeof text !== 'undefined')
						element.text(text.replace('%d', calculated));
					else
						element.text(calculated);
				});

				step.find('[data-tally]').each(function() {
					var element = $(this);
					var value = applyModifiers(parseInt(element.attr('data-tally')), element.attr('data-filter'));

					element.text(parseInt(element.attr('data-tally-qty')) * Math.ceil(stepNeededRep / value));
				});
			}
		});
	};

	var createDynamicLink = function(elem, query) {
		var link = $('<a>').attr({
			href: 'http://wowhead.com/' + query + '=' + elem.attr('data-link-' + query),
			target: '_blank'
		});

		link.text(elem.text());

		if (typeof elem.attr('data-icon') === 'undefined')
			elem.text('');

		elem.append(link);
	};

	var renderReputationDisplay = function() {
		reputationDisplay.createFrame('padder').text('Arf');

		var progressBar = reputationDisplay.createFrame('reputation-pct-bar').attr('id', 'main-reputation-bar');
		var progressBarInner = progressBar.createFrame('inner');
		var progressBarText = progressBar.createFrame('shadow');
		
		// Modifier panel
		var modifyFrame = reputationDisplay.createFrame().attr('id', 'modifier-frame');
		for (var r = 0; r < reputationModifiers.length; r++) {
			var modifier = reputationModifiers[r];
			modifier.active = typeof modifier.race !== 'undefined' && modifier.race === characterData.race;

			var modifierFrame = modifyFrame.createFrame('modifier').attr('data-index', r);
			if (modifier.active)
				modifierFrame.addClass('selected');

			var modifierIcon = modifierFrame.createFrame('icon').css('background-image', 'url(icon.php?icon=' + modifier.icon + ')');
			modifierIcon.createFrame('item-border');

			var modifierText = modifierFrame.createFrame('text');
			var modifierTitle = modifierText.createFrame('title').text(modifier.name);
			modifierText.createFrame('description').text(modifier.desc);
			modifierTitle.createFrame('pct').text('+' + (modifier.factor * 100) + '%');
		}

		var nTotalReputations = 0;
		var nPlayerReputations = 0;

		for (var i = 0; i < rosterData.length; i++) {
			var reputation = rosterData[i];
			var playerState = characterReputations[reputation.id];

			// Skip reputations this player cannot obtain due to their faction.
			if (reputation.hasOwnProperty('faction') && reputation.faction !== characterData.faction)
				continue;

			nTotalReputations++;

			var container = reputationDisplay.createFrame('reputation-container');
			var frame = container.createFrame('reputation');
			var icon = frame.createFrame('reputation-icon');
			var title = frame.createFrame('reputation-title');
			var status = frame.createFrame('reputation-status');

			var guideFrame = container.createFrame('reputation-guide-container');
			guideFrame.createFrame('reputation-guide-text').text('Loading reputation guide...');

			guideFrame.attr('data-guide', reputation.slug);
			guideFrame.attr('data-reputation-index', i);

			icon.css('background-image', 'url(images/cards/' + reputation.slug + '.jpg)');
			title.text(reputation.name);

			var standingType = standingTypes[defaultValue(reputation.standingTable, 'basic')];

			// Set the reputation data to default if the player has not encountered it.
			if (typeof playerState === 'undefined')
				playerState = characterReputations[reputation.id] = standingType.default;

			var maxStanding = defaultValue(standingType.maxStanding, standingType.stages.length);
			var maxStandingValue = defaultValue(standingType.maxStandingValue, null);

			if (playerState.standing >= maxStanding && (maxStandingValue === null || playerState.value >= maxStandingValue)) {
				status.text('Complete');
				nPlayerReputations++;
			} else {
				status.text('Incomplete');
				frame.addClass('incomplete');
			}
		}

		var pct = (nPlayerReputations / nTotalReputations) * 100;
		progressBarText.text(nPlayerReputations + ' / ' + nTotalReputations + ' (' + Math.floor(pct) + '%)');
		progressBarInner.animate({ width: pct + '%' }, 500);

		reputationDisplay.createFrame('padder').text('Arf');
	};

	// Populate realm list.
	api({ action: 'regions' }, function(res) {
		if (!res.error) {
			var regions = res.regions;
			for (var regionID in regions) {
				if (regions.hasOwnProperty(regionID)) {
					var region = regions[regionID];
					var container = realmDropDown.createFrame('realm-container');
					container.createFrame('realm-header').text(region.name);

					var realms = region.realms;
					for (var realmSlug in realms) {
						if (realms.hasOwnProperty(realmSlug))
							container
								.createFrame('realm-option')
								.text(realms[realmSlug])
								.attr('data-region', regionID)
								.attr('data-name', realms[realmSlug].toLowerCase() + ' (' + regionID + ')')
								.attr('data-slug', realmSlug);
					}

					realmContainers.push(container);
				}
			}
		} else {
			console.error('Encountered API error when retrieving realms: %o', res);
		}

		// Invoked once the realm data is obtained to validate any cached
		// value the user's browser has added to the input field.
		hideRealmDropDown();
	});

	var doc = $(document);

	// Listen for any clicks on .realm-option elements.
	doc.on('mouseenter click touchstart', '.realm-option', function() {
		selectOption($(this));
	});

	// Setup attribute-driven external links.
	$('.link').each(function() {
		var target = $(this);
		target.on('click', function() {
			window.location.href = target.attr('data-link');
		});
	});

	// Dynamic highlighting and tab-indexing.
	$('.input-field').each(function() {
		var field = $(this);
		var label = $('label[for=' + field.attr('id') + ']');
		var next = $('#' + field.attr('data-tab'));

		field.on('focus', function() {
			label.addClass('selected');
		}).on('blur', function() {
			label.removeClass('selected');
		}).on('keypress', function(e) {
			if (e.which === 13) {
				if (next.is('input[type=button]')) {
					next.click();
				} else {
					next.focus();
					setTimeout(function() { next.select(); }, 0);
				}
			}
		});
	});

	// Listen for expand/collapse requests on reputation bars.
	doc.on('click touchstart', '.reputation', function() {
		var bar = $(this);
		var guide = bar.parent().children('.reputation-guide-container');

		if (bar.hasClass('expanded')) {
			bar.removeClass('expanded');
			guide.slideUp();
		} else {
			bar.addClass('expanded');
			guide.slideDown();

			if (!guide.hasClass('downloaded')) {
				guide.addClass('downloaded');
				$.get('guides/' + guide.attr('data-guide') + '.html', function(data) {
					guide.empty().html(data);

					var guideContent = guide.find('.guide').first();

					// Add reputation bar to the top.
					var reputationBar = $('<div/>').prependTo(guideContent).addClass('reputation-pct-bar');
					var reputationHeader = $('<h1/>').text('Standing').addClass('reputation-header').prependTo(guideContent);
					var reputationBarInner = reputationBar.createFrame('inner');
					var reputationBarText = reputationBar.createFrame('shadow');

					var reputation = rosterData[parseInt(guide.attr('data-reputation-index'))];
					var playerState = characterReputations[reputation.id];

					// Calculate reputation progress/values.
					var standingType = defaultValue(reputation.standingTable, 'basic');
					var standingTable = standingTypes[standingType].stages;
					var standingRanksTable = standingTypes[standingType].ranks;

					var totalRep = 0;
					var playerRep = playerState.value;

					for (var i = 0; i < standingTable.length; i++) {
						var standingAmount = standingTable[i];

						if (playerState.standing > i)
							playerRep += standingAmount;

						totalRep += standingAmount;
					}

					// Calculate the rank name based on rep value.
					// We use this rather than standing to work around WoD bodyguards.
					var standingRank = standingRanksTable[0];
					for (var standingRankValue in standingRanksTable) {
						if (standingRanksTable.hasOwnProperty(standingRankValue)) {
							if (playerRep >= standingRankValue)
								standingRank = standingRanksTable[standingRankValue];
							else
								break;
						}
					}

					reputationHeader.text(reputationHeader.text() + ' (' + standingRank + ')');

					var pct = (playerRep / totalRep) * 100;
					reputationBarText.text(playerRep + ' / ' + totalRep + ' (' + Math.floor(pct) + '%)');
					reputationBarInner.animate({ width: pct + '%' }, 500);

					var steps = guide.find('.step');
					steps.each(function() {
						var step = $(this);

						var startStanding = parseInt(step.attr('data-standing-start'));
						var endStanding = parseInt(step.attr('data-standing-end'));

						var reputation = rosterData[parseInt(guide.attr('data-reputation-index'))];
						var playerState = characterReputations[reputation.id];

						if (playerState.standing >= endStanding) {
							var header = step.children('h3').first();
							header.text(header.text() + ' (Complete)');
							step.addClass('complete');

							step.find('[data-total]').each(function() {
								var element = $(this);
								var text = element.attr('data-text');

								if (typeof text !== 'undefined')
									element.text(text.replace('%d', '0'));
								else
									element.text('0');
							});

							step.find('[data-tally]').text(0);
						} else {
							var standingType = defaultValue(reputation.standingTable, 'basic');
							var standingTable = standingTypes[standingType].stages;

							var totalStepRep = 0;
							var playerStepRep = 0;

							for (var i = startStanding; i < endStanding; i++) {
								var standingRep = standingTable[i];

								if (playerState.standing > i)
									playerStepRep += standingRep;
								else if (playerState.standing === i)
									playerStepRep += playerState.value;

								totalStepRep += standingRep;
							}

							step.attr('data-rep-needed', Math.max(0, totalStepRep - playerStepRep));
						}
					});

					updateDynamicValues(guide);

					// Render maps
					guide.find('[data-map]').each(function() {
						var map = $(this);
						map.css('background-image', 'url(images/maps/' + map.attr('data-map') + '.jpg)');
					});

					// Expand the first non-completed stage.
					steps.not('.complete').first().addClass('expanded');

					// Render icons.
					guide.find('.rewards').find('li').each(function() {
						var item = $(this);
						var faction = item.attr('data-reward-faction');

						if (typeof faction !== 'undefined' && parseInt(faction) !== characterData.faction) {
							item.remove();
						} else {
							item.css('background-image', 'url(icon.php?icon=' + item.attr('data-icon') + ')');
							item.attr('data-title', item.attr('data-title').replace('%p', characterData.name));

							item.addClass('tooltip-top').createFrame('item-border');
						}
					});

					// Render header icons.
					guide.find('h4[data-header]').each(function() {
						var header = $(this);
						header.css('background-image', 'url(images/headers/header-' + header.attr('data-header') + '.png)');
					});

					// Create dynamic links.
					for (var l = 0; l < dynamicLinks.length; l++) {
						var linkType = dynamicLinks[l];
						guide.find('[data-link-' + linkType + ']').each(function() { createDynamicLink($(this), linkType); });
					}
				});
			}
		}
	});

	// Listen for expand clicks on reputation stages.
	doc.on('click touchstart', '.step-header', function() {
		var step = $(this).parent();
		var container = step.children('.step-contents').first();

		if (step.hasClass('expanded')) {
			container.slideUp(400, function() {
				step.removeClass('expanded');
			});
		} else {
			container.slideDown(400, function() {
				step.addClass('expanded');
			});
		}
	});

	// Listen for modifier toggles.
	doc.on('click touchstart', '.modifier', function() {
		var modifierFrame = $(this);
		var modifier = reputationModifiers[parseInt(modifierFrame.attr('data-index'))];

		modifier.active = !modifier.active;
		if (modifier.active)
			modifierFrame.addClass('selected');
		else
			modifierFrame.removeClass('selected');

		$('.reputation-guide-container').each(function() {
			updateDynamicValues($(this));
		});
	});

	// Set-up realm selection list.
	realmField.on('focus input', function() {
		showRealmDropDown($(this).val());
	}).on('blur', function() {
		hideRealmDropDown();
	});

	// Tooltip listeners.
	doc.on('mouseenter', '.rewards li', function() {
		$(this).addClass('tooltip');
	}).on('mouseleave', '.rewards li', function() {
		$(this).removeClass('tooltip');
	});

	// Register a click listener for the search button.
	$('#button-search').on('click', function() {
		// Prevent searching while data is downloading..
		if (isPerformingLookup)
			return;

		// Ensure the user has selected a realm..
		if (selectedRealm === null) {
			setErrorStatus('Please select a valid realm first.');
			return;
		}

		// Basic validation for the entered character name..
		var characterName = characterField.val().trim().toLowerCase();
		if (characterName.length < 2 || characterName.length > 12) {
			setErrorStatus('Please enter a valid character name first.');
			return;
		}

		setPendingStatus('Obtaining character reputation data...');
		isPerformingLookup = true;
		characterReputations = null;

		api({
			action: 'character',
			region: selectedRealm.region,
			realm: selectedRealm.realm,
			character: characterName
		}, function(data) {
			isPerformingLookup = false;

			if (data.error === false) {
				hideStatus();
				clearReputations();

				if (data.character !== null) {
					characterReputations = [];
					characterData = data.character;

					// Store the players reputations indexed by the ID.
					for (var i = 0; i < data.character.reputation.length; i++) {
						var reputation = data.character.reputation[i];
						characterReputations[reputation.id] = reputation;
					}

					if (rosterData !== null)
						renderReputationDisplay();
					else
						setPendingStatus('Obtaining reputation information...');
				} else {
					setErrorStatus('Character not found');
				}
			} else {
				console.error(data.errorMessage);
				setErrorStatus('Unable to retrieve character.');
			}
		});
	});

	// Download reputation roster
	api({ action: 'roster' }, function(data) {
		rosterData = data.reputations;

		for (var i = 0; i < rosterData.length; i++) {
			var reputation = rosterData[i];
			reputation.slug = reputation.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z\-]+/g, '');
		}

		if (characterReputations !== null) {
			hideStatus();
			renderReputationDisplay();
		}
	});

	// Wait for the background image to load before displaying.
	loadImage('images/reputable-background.jpg', function(url) {
		background.css('background-image', 'url(' + url + ')').fadeIn(1000);
	});
});