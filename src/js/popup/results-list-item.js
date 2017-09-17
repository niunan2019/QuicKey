define([
	"jsx!./matched-string",
	"cp",
	"lib/copy-to-clipboard",
	"react",
	"lodash"
], function(
	MatchedString,
	cp,
	copyTextToClipboard,
	React,
	_
) {
	const MaxTitleLength = 70,
		MaxURLLength = 75,
		SuspendedFaviconOpacity = .5;


	var IsDevMode = false;


	cp.management.getSelf()
		.then(function(info) {
			IsDevMode = info.installType == "development";
		});


	var ResultsListItem = React.createClass({
		ignoreMouse: true,


		onClick: function(
			event)
		{
			var item = this.props.item;

			if (IsDevMode && event.altKey) {
					// copy some debug info to the clipboard
				copyTextToClipboard([
					item.title,
					item.displayURL,
					this.props.query,
					_.toPairs(item.scores).map(a => a.join(": ")).join("\n")
				].join("\n"));
			} else {
				this.props.onItemClicked(item, event.shiftKey);
			}
		},


		onMouseMove: function(
			event)
		{
			var props = this.props;

			if (this.ignoreMouse) {
					// we'll swallow this first mousemove, since it's probably
					// from the item being rendered under the mouse, but we'll
					// respond to the next one
				this.ignoreMouse = false;
			} else if (!this.props.isSelected) {
					// the mouse is moving over this item but it's not
					// selected, which means this is the second mousemove
					// event and we haven't gotten another mouseenter.  so
					// force this item to be selected.
				props.setSelectedIndex(props.index);
			}
		},


		onMouseEnter: function(
			event)
		{
			if (!this.ignoreMouse) {
					// pass true to let the list know this was from a mouse event
				this.props.setSelectedIndex(this.props.index, true);
			}
		},


		render: function()
		{
			var props = this.props,
				item = props.item,
				query = props.query,
				scores = item.scores,
				hitMasks = item.hitMasks,
				tooltip = [
					item.title.length > MaxTitleLength ? item.title : "",
					item.displayURL.length > MaxURLLength ? item.displayURL : ""
				].join("\n"),
				className = "results-list-item " + (props.isSelected ? "selected" : ""),
				faviconStyle = {
					backgroundImage: "url(" + item.faviconURL + ")"
				};

			if (IsDevMode) {
				tooltip = _.toPairs(item.scores)
					.map(function(a) { return a.join(": "); }).join("\n") + tooltip;
			}

			if (item.unsuspendURL && !item.favIconUrl) {
					// this is a suspended tab, but The Great Suspender has
					// forgotten the faded favicon for it.  so we get the favicon
					// through chrome://favicon/ and then fade it ourselves.
				faviconStyle.opacity = SuspendedFaviconOpacity;
			}

			return <div className={className}
				style={props.style}
				title={tooltip}
				onClick={this.onClick}
				onMouseMove={this.onMouseMove}
				onMouseEnter={this.onMouseEnter}
			>
				<span className="favicon"
					style={faviconStyle}
				/>
				<MatchedString className="title"
					query={query}
					text={item.title}
					score={scores.title}
					hitMask={hitMasks.title}
				/>
				<MatchedString className="url"
					query={query}
					text={item.displayURL}
					score={scores.displayURL}
					hitMask={hitMasks.displayURL}
				/>
			</div>
		}
	});


	return ResultsListItem;
});
