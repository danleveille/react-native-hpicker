import React, {Component} from "react";
import PropTypes from 'prop-types';
import {
  StyleSheet,
  Text,
  ScrollView,
  View,
  Platform,
  TouchableWithoutFeedback,
  ViewPropTypes,
} from 'react-native';

const defaultForegroundColor = '#444';
const defaultItemWidth = 30;
const loggingEnabled = false;

const itemPropTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.any,
  style: ViewPropTypes.style,
  foregroundColor: PropTypes.string,
};
const itemDefaultProps = {
  foregroundColor: defaultForegroundColor,
};

function log(message, ...optionalParams) {
  if (loggingEnabled) {
    console.log(message, optionalParams);
  }
}

class HorizontalPickerItem extends Component {

  constructor(props) {
    super(props);
    this.state = intialState;
  }
}

const propTypes = {
  style: ViewPropTypes.style,
  selectedValue: PropTypes.any,
  children: PropTypes.array, // TODO: Make it HorizontalPicker.Item[]
  itemWidth: PropTypes.number.isRequired,
  onChange: PropTypes.func,
  renderOverlay: PropTypes.func,
  foregroundColor: PropTypes.string
};

const defaultProps = {
  foregroundColor: defaultForegroundColor,
};

const intialState = {
  selectedItem: null,
  bounds: null,
  padding: {left: 0, right: 0}

};

class HorizontalPicker extends Component {

  constructor(props) {
    super(props);
    this.state = intialState;
    this.isScrolling = false;
    this.scrollX = -1;
    this.ignoreNextScroll = false;
    this.snapDelay = 200;
    this.isMaxed = false;
  }

  static Item = HorizontalPickerItem

  componentWillReceiveProps(nextProps) {
    log('componentWillReceiveProps (isScrolling:', this.isScrolling, ')', this.props.selectedValue, '->', nextProps.selectedValue);
    if(nextProps.selectedValue > 300){
      var selectedValue = 300;
      this.isMaxed = true;
    } else {
      var selectedValue = nextProps.selectedValue;
      this.isMaxed = false;
    }
    const valueChanged = this.props.selectedValue !== selectedValue;


    const index = this.getIndexForValue(selectedValue, nextProps.children);
    const previousIndex = this.getIndexForValue(selectedValue, this.props.children);
    const rangeChanged = index !== previousIndex;
    log('current index', index);
    log('previous index', previousIndex);

    // If the user changes the item width, update the padding of the picker so everything aligns
    if(nextProps.itemWidth != this.props.itemWidth){
      var padding = {
        left: !this.state.bounds ? 0 : ((this.state.bounds.width - nextProps.itemWidth) / 2),
        right: !this.state.bounds ? 0 : ((this.state.bounds.width - nextProps.itemWidth) / 2)
      };
      log('componentWillReceiveProps padding',padding)
      // Update the padding, then after, scroll to the correct index. (later down the function, this scrolls again, but idk it works so...)
      this.setState({padding:padding},()=>{this.scrollToIndex(index, false);});
      this.scrollToIndex(index, false);
    }


    log('x:', this.scrollX);
    log('current value:', selectedValue);
    const visibleValue = this.getValueAt(this.scrollX);
    const visualsChanged = selectedValue !== visibleValue;
    log('visible value:', visibleValue);

    log('valueChanged:', valueChanged);
    log('rangeChanged:', rangeChanged);
    log('visualsChanged:', visualsChanged);

    if (rangeChanged) {
      // The given children have changed
      log('rangeChanged -> resposition');
      if (Platform.OS === 'android') {
        // Android fix; For some reason it only scroll a small distance. Looks
        // pretty awful and needs a better solution, this is just to fix the
        // out-of-sync issue.
        setTimeout(() => {
          this.scrollToIndex(index, false);
        }, 1);
      } else {
        this.scrollToIndex(index, false);
      }
    } else if (valueChanged) {
      log('valueChanged -> scroll');
      this.scrollToIndex(index, true);
    } else if (!this.isScrolling && visualsChanged) {
      // Check if the current value is even possible.
      // If not, we don't know where to scroll, so ignore.
      const indexForSelectedValue = this.getIndexForValue(selectedValue, nextProps.children);
      log('visualsChanged -> scroll');
      if (indexForSelectedValue !== -1) {
        this.scrollToIndex(indexForSelectedValue, true);
      }
    }
  }

  componentDidMount() {
    this.scrollToValue(this.props.selectedValue, false);
  }

  getItemWidth = () => this.props.itemWidth && this.props.itemWidth > 0
    ? this.props.itemWidth : defaultItemWidth;

  getComponentWidth = () =>
    this.state.bounds ? this.state.bounds.width : 0;

  getValueAt = (x) => {
    const child = this.getChildren()[this.getIndexAt(x)];
    return child ? child.props.value : null;
  }

  getIndexAt = (x) => {
    const dx = this.getComponentWidth() / 2 - this.state.padding.left;
    return Math.floor((x + dx) / this.getItemWidth());
  }

  getIndexForValue = (item, children = this.getChildren()) => {
    const index = children.findIndex(e => e.props.value === item);
    log('getIndexForValue, value:', item, 'index:', index);
    return index;
  }

  getChildren = (children = this.props.children) => React.Children.toArray(children);

  scrollToValue = (itemValue, animated = true) => {
    log('scrollToValue ->', itemValue);
    const index = this.getIndexForValue(itemValue);
    this.scrollToIndex(index, animated);
  }

  scrollToIndex = (index, animated = true, initial = false) => {
    log('scrollToIndex ->', index);

    if (index < 0) {
      // Error; invalid index.
      return;
    }

    this.isScrolling = true;

    const snapX = index * this.getItemWidth();
    // Make sure the component hasn't been unmounted
    if (this.refs.scrollview) {
      log('scroll ->', snapX);
      
        
      // Dan's edit. For some reason it needs to be delayed on android otherwise it won't scroll. No clue... :(
      if (Platform.OS === 'android') {
        setTimeout(() => {
          this.refs.scrollview.scrollTo({x: snapX, y: 0, animated:true});
        }, 1);
      } else {
        this.refs.scrollview.scrollTo({x: snapX, y: 0, animated});
      }


      // iOS fix
      if (!initial && Platform.OS === 'ios') {
        log('ignoreNextScroll');
        this.ignoreNextScroll = true;
      }
    }
  }

  onScroll = (event) => {
    // Sometimes onMomentumScrollBegin event seems to be missing and onMomentumScrollEnd
    // is sent twice. However, if we receive an onScroll after onMomentumScrollEnd, we
    // can assume that the momentum scroll is continued.
    this.isScrolling = true;
    this.scrollX = event.nativeEvent.contentOffset.x;
    log('onScroll, x:', this.scrollX);
    this.cancelDelayedSnap();
  }

  onScrollBeginDrag = (event) => {
    log('onScrollBeginDrag', this.scrollStart);
    this.isScrolling = true;
    this.scrollStart = event.nativeEvent.contentOffset.x;
    this.cancelDelayedSnap();
    this.ignoreNextScroll = false;
  }

  onScrollEndDrag = (/*event*/) => {
    log('onScrollEnd');
    this.isScrolling = false;
    if (this.ignoreNextScroll) {
      log('onScrollEnd, ignored');
      this.ignoreNextScroll = false;
      return;
    }
    this.delayedSnap();
  }

  onMomentumScrollBegin = (event) => {
    log('onMomentumScrollBegin', event.nativeEvent);
    this.isScrolling = true;
    this.cancelDelayedSnap();
  }

  onMomentumScrollEnd = (/*event*/) => {
    log('onMomentumScrollEnd');
    this.isScrolling = false;
    if (this.ignoreNextScroll) {
      log('onMomentumScrollEnd, ignored');
      this.ignoreNextScroll = false;
      return;
    }
    this.delayedSnap();
  }

  delayedSnap = () => {
    log('delayedSnap, cancelling previous...');
    this.cancelDelayedSnap();
    log('delayedSnap, scheduling the snap');
    this.snapNoMomentumTimeout =
      setTimeout(() => {
        const index = this.getIndexAt(this.scrollX);
        const item = this.getChildren()[index];
        log('doing the snap ->', item.props.value);
        this.onChange(item.props.value);
        this.scrollToIndex(index);
      }, this.snapDelay);
  }

  cancelDelayedSnap = () => {
    if (this.snapNoMomentumTimeout) {
      log('cancelled the delayed snap');
      log('cancelDelayedSnap');
      clearTimeout(this.snapNoMomentumTimeout);
      this.snapNoMomentumTimeout = null;
    }
  }

  onChange = (itemValue) => {
    log('onChange', itemValue, this.props.selectedValue);
    if (typeof this.props.onChange == 'function') {
      if(!this.isMaxed){
        this.props.onChange(itemValue);
      }
    }
  }

  handleItemPress = (value) => {
    log('handleItemPress', value);
    return () => {
      if (value && typeof this.props.onChange == 'function') {
        this.props.onChange(value);
      }
    };
  }

  renderChildren = (children) => {
    return children.map(this.renderChild);
  }

  renderChild = (child) => {
    // vKey = key: 1, 2, 3
    // value = displayed value: 5, 10, 15
    const itemValue = child.props.value;
    const color = this.props.foregroundColor || defaultForegroundColor;
    const isLarger = child.props.vKey == 1 || child.props.vKey % 5 == 0;
    return (
      <View
        key={itemValue}>
        <TouchableWithoutFeedback
          style={{overflow:'visible'}}
          onPress={(v) => this.props.onChange(itemValue)}
          >
          <View style={[styles.itemContainer, {flexDirection:'column',flex:1,width: this.getItemWidth()}]}>
            <View style={[{borderRightColor:'#fff',borderRightWidth:1,height:isLarger ? 14 : 9}]}></View>
            <View style={[{borderRightColor:'#fff',borderRightWidth:1,height:isLarger ? 14 : 9}]}></View>
          </View>
        </TouchableWithoutFeedback>
        {(isLarger || this.getItemWidth() == 30) &&
          <View style={[StyleSheet.absoluteFill,{justifyContent:'center'}]}>
            <Text style={[{marginHorizontal:-10},isLarger ? styles.itemText : styles.itemTextSmall, child.props.style]}>{child.props.label}</Text>
          </View>
        }
      </View>
    );
  }

// ,,justifyContent: 'center',alignSelf:'stretch',
      // <View style={[s.rowItem,{width:this.itemSize,alignItems:'center',justifyContent:'space-between'}]}>
      //   <View style={[{marginHorizontal:-10}]}>
      //   {isLarger &&
      //     <Text style={[s.white,s.small,s.center]} numberOfLines={1}>{this.props.i}</Text>
      //   }
      //   </View>
      // </View>


  onLayout = (event) => {
    log('onLayout');
    const {nativeEvent: {layout: {x, y, width, height}}} = event;
    const bounds = {width, height};
    const leftItemWidth = this.getItemWidth();
    const rightItemWidth = this.getItemWidth();
    var padding = {
      left: !bounds ? 0 : ((bounds.width - leftItemWidth) / 2),
      right: !bounds ? 0 : ((bounds.width - rightItemWidth) / 2)
    };
    this.setState({
      bounds,
      padding
    });
    log('ONLAYOUT PADDING',padding)
    log('ONLAYOUT selectedValue',this.props.selectedValue)

    const index = this.getIndexForValue(this.props.selectedValue);
    log('onLayout -> scrollToIndex');
    this.scrollToIndex(index, false);
  }

  renderDefaultOverlay = () => {
    const color = this.props.foregroundColor;
    return (
      <View style={{flex: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: color}} />
    );
  }

  render() {
    const bounds = this.state.bounds;
    const renderOverlay = this.props.renderOverlay || this.renderDefaultOverlay;
    return (
      <View style={[this.props.style]}>
        <ScrollView
          ref='scrollview'
          decelerationRate={0.993}
          scrollEventThrottle={16}
          contentContainerStyle={{paddingLeft: this.state.padding.left, paddingRight: this.state.padding.right}}
          showsHorizontalScrollIndicator={false}
          keyboardDismissMode="none"
          keyboardShouldPersistTaps="handled"
          horizontal={true}
          onScroll={this.onScroll}
          onScrollBeginDrag={this.onScrollBeginDrag}
          onScrollEndDrag={this.onScrollEndDrag}
          onMomentumScrollBegin={this.onMomentumScrollBegin}
          onMomentumScrollEnd={this.onMomentumScrollEnd}
          onLayout={this.onLayout}
          style={this.scrollView}>
          <View style={styles.contentContainer}>
            {bounds && this.renderChildren(this.props.children)}
          </View>
        </ScrollView>
        <View style={styles.overlay} pointerEvents='none'>
          <View style={[{flex: 1,alignItems:'center',width: this.getItemWidth()*2}]}>
            {renderOverlay()}
          </View>
        </View>
      </View>
    );
  }
}

var styles = StyleSheet.create({
  image: {
    flex: 1
  },
  touchArea: {
    flex: 1,
    alignSelf: 'stretch',
  },
  scrollView: {
    flex: 1
  },
  contentContainer: {
    flexDirection: 'row'
  },
  itemContainer: {
    flexDirection: 'column',
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  item: {
    flexDirection: 'column',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'yellow'
  },
  itemText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#ffffff'
  },
  itemTextSmall: {
    fontSize: 12,
    textAlign: 'center',
    color: '#b69bda'
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'column',
    flex: 1,
    alignItems: 'center'
  }
});

HorizontalPickerItem.propTypes = itemPropTypes;
HorizontalPickerItem.defaultProps = itemDefaultProps;

HorizontalPicker.propTypes = propTypes;
HorizontalPicker.defaultProps = defaultProps;

export default HorizontalPicker;
