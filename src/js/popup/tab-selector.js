define([
	"array-score",
	"quicksilver-score",
	"get-bookmarks",
	"get-history",
	"react",
	"jsx!./tab-item",
	"lodash"
], function(
	arrayScore,
	qsScore,
	getBookmarks,
	getHistory,
	React,
	TabItem,
	_
) {
	const MinScore = .2,
		MaxItems = 10,
		SuspendedURLPattern = /^chrome-extension:\/\/klbibkeccnjlkjkiokjodocebajanakg\/suspended\.html#(?:.*&)?uri=(.+)$/,
		ProtocolPattern = /^(chrome-extension:\/\/klbibkeccnjlkjkiokjodocebajanakg\/suspended\.html#(?:.*&)?uri=)?(https?|file):\/\//,
		BookmarksQuery = "/b ",
		BookmarksQueryPattern = new RegExp("^" + BookmarksQuery),
		HistoryQuery = "/h ",
		HistoryQueryPattern = new RegExp("^" + HistoryQuery),
		WhitespacePattern = /\s+/g;


		// use title and url as the two keys to score
	var scoreArray = arrayScore(qsScore, ["title", "displayURL"]);


	var TabSelector = React.createClass({
		mode: "tabs",
		bookmarks: [],
		history: [],
		ignoreMouse: true,


		getInitialState: function()
		{
			var query = this.props.initialQuery;

				// add a displayURL to each tab so that we can score against it
				// in onQueryChange.  also add a URL without the Great Suspender
				// preamble that we can use with chrome://favicon/ to get the
				// site's favicon instead of the Great Suspender's, as there are
				// times it hasn't generated a faded icon for some sites.
			this.props.tabs.forEach(function(tab) {
				var url = tab.url;

// TODO: move this to main.js
				tab.displayURL = url.replace(ProtocolPattern, "");
				tab.unsuspendURL = url.replace(SuspendedURLPattern, "$1");
			});

			return {
				query: query,
				matchingItems: this.getMatchingItems(query),
					// default to the first item being selected, in case we got
					// an initial query
				selected: 0
			};
		},


		componentDidMount: function()
		{
			var searchBox = this.refs.searchBox,
				queryLength = searchBox.value.length;

				// even if there's a default value, the insertion point gets set
				// to the beginning of the input field, instead of at the end.
				// so move it there after the field is created.
			searchBox.setSelectionRange(queryLength, queryLength);
		},


		getMatchingItems: function(
			query)
		{
			var mode = this.mode,
				items = mode == "tabs" ? this.props.tabs :
					mode == "bookmarks" ? this.bookmarks : this.history,
				scores = scoreArray(items, query),
					// first limit the tabs to 10, then drop barely-matching results
				matchingItems = _.dropRightWhile(scores.slice(0, MaxItems), function(item) {
					return item.score < MinScore;
				});

			return matchingItems;
		},


		focusTab: function(
			tab,
			unsuspend)
		{
			if (tab) {
				var updateData = { active: true };

				if (unsuspend && tab.url != tab.unsuspendURL) {
						// change to the unsuspended URL
					updateData.url = tab.unsuspendURL;
				}

					// switch to the selected tab
				chrome.tabs.update(tab.id, updateData);

					// make sure that tab's window comes forward
				if (tab.windowId != chrome.windows.WINDOW_ID_CURRENT) {
					chrome.windows.update(tab.windowId, { focused: true });
				}

					// we seem to have to close the window in a timeout so that
					// the hover state of the button gets cleared
				setTimeout(function() { window.close(); }, 0);
			}
		},


		openBookmark: function(
			bookmark,
			newWindow,
			newTab)
		{
			if (bookmark) {
				if (newWindow) {
					chrome.windows.create({ url: bookmark.url });
				} else if (newTab) {
					chrome.tabs.create({ url: bookmark.url });
				} else {
					chrome.tabs.update({ url: bookmark.url });
				}

					// we seem to have to close the window in a timeout so that
					// the hover state of the button gets cleared
				setTimeout(function() { window.close(); }, 0);
			}
		},


		modifySelected: function(
			delta)
		{
			var selected = this.state.selected,
				maxIndex = this.state.matchingItems.length - 1;

			if (!_.isNumber(selected)) {
				if (delta > 0) {
					selected = -1;
				} else {
					selected = maxIndex;
				}
			}

			this.setSelectedIndex(selected + delta);
		},


		setSelectedIndex: function(
			selected,
			fromMouse)
		{
			var maxIndex = this.state.matchingItems.length - 1;

			if (!fromMouse || !this.ignoreMouse) {
				selected = Math.min(Math.max(0, selected), maxIndex);
				this.setState({ selected: selected });
			}
		},


		onQueryChange: function(
			event)
		{
			var query = event.target.value,
				queryString = query,
				matchingItems,
				promise = Promise.resolve(),
				self = this;

			if (BookmarksQueryPattern.test(query)) {
				this.mode = "bookmarks";
				query = query.replace(BookmarksQueryPattern, "");
			} else if (HistoryQueryPattern.test(query)) {
				this.mode = "history";
				query = query.replace(HistoryQueryPattern, "");
			} else {
				this.mode = "tabs";
			}

			if (this.mode == "bookmarks" && !this.bookmarks.length) {
				promise = getBookmarks().then(function(bookmarks) {
					self.bookmarks = bookmarks;
				});
			} else if (this.mode == "history" && !this.history.length) {
				promise = getHistory().then(function(history) {
					self.history = history;
				});
			}

				// including spaces in the query generally produces worse results
			query = query.replace(WhitespacePattern, "");

			promise.then(function() {
				matchingItems = self.getMatchingItems(query);

				self.setState({
					query: queryString,
					matchingItems: matchingItems,
					selected: 0
				});
			});
		},


		onMouseMove: function(
			event)
		{
			this.ignoreMouse = false;
		},


		onKeyDown: function(
			event)
		{
			var searchBox = this.refs.searchBox,
				query = searchBox.value,
				state = this.state;

			switch (event.which) {
				case 27:	// escape
					if (!query) {
							// pressing esc in an empty field should close the popup
						window.close();
					} else {
							// there's a default behavior where pressing esc
							// clears the input, but we want to control what it
							// gets cleared to
						event.preventDefault();

							// if we're searching for bookmarks, reset the query
							// to just /b, rather than clearing it, unless it's
							// already /b, in which case, clear it
						if (this.mode == "tabs" || query == BookmarksQuery ||
								query == HistoryQuery) {
							query = "";
						} else if (this.mode == "bookmarks") {
							query = BookmarksQuery;
						} else if (this.mode == "history") {
							query = HistoryQuery;
						}

						searchBox.value = query;
						this.onQueryChange({ target: { value: query }});
					}
					break;

				case 38:	// up arrow
					this.modifySelected(-1);
					event.preventDefault();
					break;

				case 40:	// down arrow
					this.modifySelected(1);
					event.preventDefault();
					break;

				case 13:	// enter
					if (this.mode == "tabs") {
						this.focusTab(state.matchingItems[state.selected], event.shiftKey);
					} else {
						this.openBookmark(state.matchingItems[state.selected],
							event.shiftKey, event.ctrlKey);
					}
					event.preventDefault();
					break;
			}
		},


		render: function()
		{
			var selectedIndex = this.state.selected,
				query = this.state.query,
				tabItems = this.state.matchingItems.map(function(tab, i) {
					return <TabItem
						key={tab.id}
						tab={tab}
						index={i}
						isSelected={i == selectedIndex}
						query={query}
						ignoreMouse={this.state.ignoreMouse}
						focusTab={this.focusTab}
						setSelectedIndex={this.setSelectedIndex}
						onMouseMove={this.onMouseMove}
					/>
				}, this),
					// hide the ul when the list is empty, so we don't force the
					// popup to be taller than the input when it's first opened
				listStyle = {
					display: tabItems.length ? "block" : "none"
				};

			return <div className="tab-selector">
				<input type="search"
					ref="searchBox"
					className="search-box"
					tabIndex="0"
					placeholder="Search for a tab title or URL"
					spellCheck={false}
					defaultValue={query}
					autoFocus={true}
					onChange={this.onQueryChange}
					onKeyDown={this.onKeyDown}
				/>
				<ul className="results-list"
					style={listStyle}
				>
					{tabItems}
				</ul>
			</div>
		}
	});


	return TabSelector;
});
