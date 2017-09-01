define(function() {
// TODO: this misses chars at beginning of string.  but it's only used when matching subsequent chars, so does it matter?
	var WhitespacePattern = /[-/:()<>%._=&\[\]\s]/,
		UpperCasePattern = /[A-Z]/;


	function scoreForAbbreviation(
		itemString,
		abbreviation,
		hitMask,
		searchRange,
		abbreviationRange)
	{
		searchRange = searchRange || new Range(0, itemString.length);
		abbreviationRange = abbreviationRange || new Range(0, abbreviation.length);

		if (!abbreviation || abbreviationRange.length > searchRange.length) {
			return 0;
		}

		if (!abbreviationRange.length) {
			return 0.9;
		}

// TODO: we may need to switch to this to get the same score as QSense.m, but right
// now the selector expects 0 scores when there's no query
// 		if (!abbreviation || !abbreviationRange.length) {
// 			return 0.9;
// 		}
//
// 		if (abbreviationRange.length > searchRange.length) {
// 			return 0;
// 		}

		for (var i = abbreviationRange.length; i > 0; i--) {
			var abbreviationSubstring = abbreviation.substr(abbreviationRange.location, i),
				matchedRange = rangeOfString(itemString, abbreviationSubstring, searchRange);

			if (!matchedRange.isValid()) {
				continue;
			}

// TODO: do we need this?  new code doesn't have it
			if (matchedRange.location + abbreviationRange.length > searchRange.max()) {
				continue;
			}

			if (hitMask) {
				addIndexesInRange(hitMask, matchedRange);
			}

			var remainingSearchRange = new Range(matchedRange.max(), searchRange.max() - matchedRange.max()),
				remainingScore = scoreForAbbreviation(itemString, abbreviation, hitMask, remainingSearchRange,
					new Range(abbreviationRange.location + i, abbreviationRange.length - i));

			if (remainingScore) {
				var score = remainingSearchRange.location - searchRange.location;

					// ignore skipped characters if it's first letter of a word
				if (matchedRange.location > searchRange.location) { //if some letters were skipped
					var j;

					if (WhitespacePattern.test(itemString.charAt(matchedRange.location - 1))) {
						for (j = matchedRange.location - 2; j >= searchRange.location; j--) {
							if (WhitespacePattern.test(itemString.charAt(j))) {
								score--;
							} else {
								score -= 0.15;
							}
						}
					} else if (UpperCasePattern.test(itemString.charAt(matchedRange.location))) {
						for (j = matchedRange.location - 1; j >= searchRange.location; j--) {
							if (UpperCasePattern.test(itemString.charAt(j))) {
								score--;
							} else {
								score -= 0.15;
							}
						}
					} else {
// TODO: switch to / 2 to make it score like the latest Quicksilver
// 						score -= (matchedRange.location - searchRange.location) / 2;
						score -= matchedRange.location - searchRange.location;
					}
				}

// TODO: limiting the multiplier reduces the scores of very long URLs
// 				score += remainingScore * Math.min(remainingSearchRange.length, 50);
				score += remainingScore * remainingSearchRange.length;
				score /= searchRange.length;

				return score;
			}
		}

		return 0;
	}


	function Range(
		location,
		length)
	{
		if (typeof location == "undefined") {
			this.location = -1;
			this.length = 0;
		} else {
			this.location = location;
			this.length = length;
		}
	}


	Range.prototype.max = function()
	{
		return this.location + this.length;
	};


	Range.prototype.isValid = function()
	{
		return (this.location > -1);
	};


	function rangeOfString(
		string,
		substring,
		searchRange)
	{
		searchRange = searchRange || new Range(0, string.length);

		var stringToSearch = string.substr(searchRange.location, searchRange.length).toLowerCase(),
			subStringIndex = stringToSearch.indexOf(substring.toLowerCase()),
			result = new Range();

		if (subStringIndex > -1) {
			result.location = subStringIndex + searchRange.location;
			result.length = substring.length;
		}

		return result;
	}


	function addIndexesInRange(
		indexes,
		range)
	{
		for (var i = range.location; i < range.max(); i++) {
			indexes.push(i);
		}

		return indexes;
	}


	return scoreForAbbreviation;
});
