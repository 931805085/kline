import {Control} from './control'
import {KlineTrade} from './kline_trade'
import {ChartManager} from './chart_manager'
import {ChartSettings} from './chart_settings'
import {Template} from './templates'
import '../css/main.css'
import tpl from '../view/tpl.html'
import fire from './firebase'
import $ from 'jquery'


export default class Kline {

    static created = false;
    static instance = null;

    constructor(option) {
        this.element = "#kline_container";
        this.chartMgr = null;
        this.G_HTTP_REQUEST = null;
        this.timer = null;
        this.buttonDown = false;
        this.init = false;
        this.requestParam = "";
        this.data = {};
        this.width = 1200;
        this.height = 650;
        this.symbol = "";
        this.symbolName = "";
        this.range = null;
        this.url = "";
        this.limit = 1000;
        this.type = "poll";
        this.subscribePath = "";
        this.sendPath = "";
        this.stompClient = null;
        this.intervalTime = 5000;
        this.debug = true;
        this.language = "zh-cn";
        this.theme = "dark";
        this.ranges = ["1w", "1d", "1h", "30m", "15m", "5m", "1m", "line"];
        this.showTrade = true;
        this.tradeWidth = 250;
        this.socketConnected = false;
        this.enableSockjs = true;
        this.reverseColor = false;
        this.isSized = false;
        this.paused = false;
        this.subscribed = null;
        this.disableFirebase = false;
        this.loading = false;
        this.rollspeed = 30;
        this.isFullScreen = false;
        this.showToolbar = true;
        this.showIndic = true;
        this.rotate = 0;
        this.dealMouseWheelEvent = true;
        this.autoIntervalTime = false;

        this.periodMap = {
            "01w": 7 * 86400 * 1000,
            "03d": 3 * 86400 * 1000,
            "01d": 86400 * 1000,
            "12h": 12 * 3600 * 1000,
            "06h": 6 * 3600 * 1000,
            "04h": 4 * 3600 * 1000,
            "02h": 2 * 3600 * 1000,
            "01h": 3600 * 1000,
            "30m": 30 * 60 * 1000,
            "15m": 15 * 60 * 1000,
            "05m": 5 * 60 * 1000,
            "03m": 3 * 60 * 1000,
            "01m": 60 * 1000,
            "line": 60 * 1000
        };

        this.tagMapPeriod = {
            "1w": "01w",
            "3d": "03d",
            "1d": "01d",
            "12h": "12h",
            "6h": "06h",
            "4h": "04h",
            "2h": "02h",
            "1h": "01h",
            "30m": "30m",
            "15m": "15m",
            "5m": "05m",
            "3m": "03m",
            "1m": "01m",
            "line": "line"
        };

        Object.assign(this, option);

        if (!Kline.created) {
            Kline.instance = this;
            Kline.created = true;
        }

        return Kline.instance;
    }


    /*********************************************
     * Methods
     *********************************************/

    draw() {
        Kline.trade = new KlineTrade();
        Kline.chartMgr = new ChartManager({
            _captureMouseWheelDirectly: this.dealMouseWheelEvent
        });

        let view = $.parseHTML(tpl);
        for (let k in this.ranges) {
            let res = $(view).find('[name="' + this.ranges[k] + '"]');
            res.each(function (i, e) {
                $(e).attr("style", "display:inline-block");
            });
        }
        $(this.element).html(view);

        setInterval(Control.refreshFunction, this.intervalTime);
        if (this.type === "stomp") {
            Control.socketConnect();
        }

        if (!this.disableFirebase) {
            fire();
        }

        this.registerMouseEvent();
        ChartManager.instance.bindCanvas("main", document.getElementById("chart_mainCanvas"));
        ChartManager.instance.bindCanvas("overlay", document.getElementById("chart_overlayCanvas"));
        Control.refreshTemplate();
        Control.onSize(this.width, this.height);
        Control.readCookie();

        this.setTheme(this.theme);
        this.setLanguage(this.language);

        $(this.element).css({visibility: "visible"});

        // 设置界面元素的显示
        if (!this.showIndic)
            this.switchIndic(false);
        if (!this.showToolbar)
            this.switchToolbar(this.showToolbar);
        if (!this.showTrade)
            this.setShowTrade(this.showTrade);
        if (this.isFullScreen)
            this.sizeKline(this.isFullScreen);
        if (this.rotate!==0)
            this.switchRotate(this.rotate);
    }

    resize(width, height) {
        this.width = width || window.innerWidth;
        this.height = height || window.innerHeight;
        Control.onSize(this.width, this.height);
    }

    setSymbol(symbol, symbolName) {
        this.symbol = symbol;
        this.symbolName = symbolName;
        Control.switchSymbol(symbol);
        this.onSymbolChange(symbol, symbolName);
    }

    setTheme(style) {
        this.theme = style;
        Control.switchTheme(style);
    }

    setLanguage(lang) {
        this.language = lang;
        Control.chartSwitchLanguage(lang);
    }

    setShowTrade(isShow) {
        this.showTrade = isShow;
        if (isShow) {
            Control.switchTrade('on');
        } else {
            Control.switchTrade('off');
        }
    }

    toggleTrade() {
        let instance = Kline.instance;
        instance.setShowTrade(!instance.showTrade);
    }

    setIntervalTime(intervalTime) {
        this.intervalTime = intervalTime;
        if (this.debug) {
            console.log('DEBUG: interval time changed to ' + intervalTime);
        }
    }

    pause() {
        if (this.debug) {
            console.log('DEBUG: kline paused');
        }
        this.paused = true;
    }

    resend() {
        if (this.debug) {
            console.log('DEBUG: kline continue');
        }
        this.paused = false;
        Control.requestData(true);
    }

    connect() {
        if (this.type !== 'stomp') {
            if (this.debug) {
                console.log('DEBUG: this is for stomp type');
            }
            return;
        }
        Control.socketConnect();
    }

    disconnect() {
        if (this.type !== 'stomp') {
            if (this.debug) {
                console.log('DEBUG: this is for stomp type');
            }
            return;
        }
        if (this.stompClient) {
            this.stompClient.disconnect();
            this.socketConnected = false;
        }
        if (this.debug) {
            console.log('DEBUG: socket disconnected');
        }
    }

    switchIndic(status) {
        if (status) {
            Control.switchIndic('on');
            $('#chart_show_indicator').addClass('selected');
        } else {
            Control.switchIndic('off');
            $('#chart_show_indicator').removeClass('selected');
        }
    }
    
    switchToolbar(status) {
        if (status) {
            $('#chart_toolbar').removeClass('hide');
        } else {
            $('#chart_toolbar').addClass('hide');
        }
    }

    static autoFull() {
        Kline.instance.resize(document.body.clientWidth, document.body.clientHeight);
    }
    
    sizeKline(isSized) {
        if (isSized === undefined) {
            Kline.instance.isSized = !Kline.instance.isSized;
        } else {
            Kline.instance.isSized = isSized;
        }

        if (Kline.instance.isSized) {
            $(Kline.instance.element).css({
                position: 'fixed',
                left: '0',
                right: '0',
                top: '0',
                bottom: '0',
                width: '100%',
                height: '100%',
                zIndex: '10000'
            });

            Control.onSize();
            $('html,body').css({width: '100%', height: '100%', overflow: 'hidden'});
            $(window).bind('resize', Kline.autoFull);
        } else {
            $(Kline.instance.element).attr('style', '');
            $('html,body').attr('style', '');
            Control.onSize(Kline.instance.width, Kline.instance.height);
            $(Kline.instance.element).css({visibility: 'visible', height: Kline.instance.height + 'px'});
            $(window).unbind('resize', Kline.autoFull);
        }
    }

    switchRotate(rotate) {
        let element = $(this.element);
        element.removeClass(['rotate90','rotate180','rotate270']);
        switch(rotate%4) {
            case 1:
                this.rotate = 1;
                element.addClass('rotate90');
                break;
            case 2:
                this.rotate = 2;
                element.addClass('rotate180');
                break;
            case 3:
                this.rotate = 3;
                element.addClass('rotate270');
                break;
            default:
                this.rotate = 0;
                break;
        }
    }

    adjustScale(newScale) {
        if (!this.chartMgr._highlightedFrame)
            this.chartMgr.onMouseMove("frame0", 1, 1, false);
        if (newScale>0) {
            for (let i=newScale;i>0;i--){
                Control.mouseWheel(null,1);
            }
        } else if (newScale<0) {
            for (let i=-newScale;i>0;i--){
                Control.mouseWheel(null,-1);
            }
        }
    }
    
    /*********************************************
     * Events
     *********************************************/

    onResize(width, height) {
        if (this.debug) {
            console.log("DEBUG: chart resized to width: " + width + " height: " + height);
        }
    }

    onLangChange(lang) {
        if (this.debug) {
            console.log("DEBUG: language changed to " + lang);
        }
    }

    onSymbolChange(symbol, symbolName) {
        if (this.debug) {
            console.log("DEBUG: symbol changed to " + symbol + " " + symbolName);
        }
    }

    onThemeChange(theme) {
        if (this.debug) {
            console.log("DEBUG: themes changed to : " + theme);
        }
    }

    onRangeChange(range) {
        if (this.debug) {
            console.log("DEBUG: range changed to " + range);
        }
    }

    created() {
        if (this.debug) {
            console.log("DEBUG: Kline Created " + range);
        }
    }

    onLoadHistory() {
        if (Kline.instance.debug) {
            console.log("DEBUG: Load History Data ");
        }
        let f = Kline.instance.chartMgr.getDataSource("frame0.k0").getFirstDate();

        if (f === -1) {
            let requestParam = Control.setHttpRequestParam(Kline.instance.symbol, Kline.instance.range, Kline.instance.limit, null);
            Control.requestData(true,requestParam);
        } else {
            let requestParam = Control.setHttpRequestParam(Kline.instance.symbol, Kline.instance.range, Kline.instance.limit, f.toString(),'history');
            Control.requestData(true,requestParam);
        }
        ChartManager.instance.redraw('All', false);
    }

    registerMouseEvent() {
        $(document).ready(function () {
            function __resize() {
                if (navigator.userAgent.indexOf('Firefox') >= 0) {
                    setTimeout(function () {
                        Control.onSize(this.width, this.height)
                    }, 200);
                } else {
                    Control.onSize(this.width, this.height)
                }
            }
            $(Kline.instance.element).attr('tabindex', 1).keydown(function(event){
                let rollspeed=Kline.instance.rollspeed;
                if (event.keyCode==39) {
                    let mgr = ChartManager.instance;
                    mgr.onMouseDown('frame0',0, 0);
                    mgr.onMouseMove("frame0", rollspeed, 0, true);
                    mgr.onMouseUp('frame0',rollspeed, 0);
                    mgr.redraw("All", false);
                } else if (event.keyCode==37) {
                    let mgr = ChartManager.instance;
                    mgr.onMouseDown('frame0',rollspeed, 0);
                    mgr.onMouseMove("frame0", 0, 0, true);
                    mgr.onMouseUp('frame0',0, 0);
                    mgr.redraw("All", false);
                }
            })

            $('#chart_overlayCanvas').bind("contextmenu", function (e) {
                e.cancelBubble = true;
                e.returnValue = false;
                e.preventDefault();
                e.stopPropagation();
                return false;
            });
            $("#chart_overlayCanvas").bind('_LoadHistory', Kline.instance.onLoadHistory);
            $(".chart_container .chart_dropdown .chart_dropdown_t")
                .mouseover(function () {
                    let container = $(".chart_container");
                    let title = $(this);
                    let dropdown = title.next();
                    let containerLeft = container.offset().left;
                    let titleLeft = title.offset().left;
                    let containerWidth = container.width();
                    let titleWidth = title.width();
                    let dropdownWidth = dropdown.width();
                    let d = ((dropdownWidth - titleWidth) / 2) << 0;
                    if (titleLeft - d < containerLeft + 4) {
                        d = titleLeft - containerLeft - 4;
                    } else if (titleLeft + titleWidth + d > containerLeft + containerWidth - 4) {
                        d += titleLeft + titleWidth + d - (containerLeft + containerWidth - 4) + 19;
                    } else {
                        d += 4;
                    }
                    dropdown.css({"margin-left": -d});
                    title.addClass("chart_dropdown-hover");
                    dropdown.addClass("chart_dropdown-hover");
                })
                .mouseout(function () {
                    $(this).next().removeClass("chart_dropdown-hover");
                    $(this).removeClass("chart_dropdown-hover");
                })
                .click(function() {
                    let t = $(this);
                    if (t.hasClass("chart_dropdown-hover")) {
                        t.trigger('mouseout');
                    } else {
                        t.trigger('mouseover');
                    }
                });
            $(".chart_dropdown_data")
                .mouseover(function () {
                    $(this).addClass("chart_dropdown-hover");
                    $(this).prev().addClass("chart_dropdown-hover");
                })
                .mouseout(function () {
                    $(this).prev().removeClass("chart_dropdown-hover");
                    $(this).removeClass("chart_dropdown-hover");
                });
            $("#chart_btn_parameter_settings").click(function () {
                $('#chart_parameter_settings').addClass("clicked");
                $(".chart_dropdown_data").removeClass("chart_dropdown-hover");
                $("#chart_parameter_settings").find("th").each(function () {
                    let name = $(this).html();
                    let index = 0;
                    let tmp = ChartSettings.get();
                    let value = tmp.indics[name];
                    $(this.nextElementSibling).find("input").each(function () {
                        if (value !== null && index < value.length) {
                            $(this).val(value[index]);
                        }
                        index++;
                    });
                });
            });
            $("#close_settings").click(function () {
                $('#chart_parameter_settings').removeClass("clicked");
            });
            $(".chart_container .chart_toolbar_tabgroup a")
                .click(function () {
                    Control.switchPeriod($(this).parent().attr('name'));

                });
            $("#chart_toolbar_periods_vert ul a").click(function () {

                Control.switchPeriod($(this).parent().attr('name'));

            });

            $(".market_chooser ul a").click(function () {
                Control.switchSymbol($(this).attr('name'));
            });

            $('#chart_show_tools')
                .click(function () {
                    if ($(this).hasClass('selected')) {
                        Control.switchTools('off');
                    } else {
                        Control.switchTools('on');
                    }
                });
            $("#chart_toolpanel .chart_toolpanel_button")
                .click(function () {
                    $(".chart_dropdown_data").removeClass("chart_dropdown-hover");
                    $("#chart_toolpanel .chart_toolpanel_button").removeClass("selected");
                    $(this).addClass("selected");
                    let name = $(this).children().attr('name');
                    Kline.instance.chartMgr.setRunningMode(ChartManager.DrawingTool[name]);
                });
            $('#chart_show_indicator')
                .click(function () {
                    if ($(this).hasClass('selected')) {
                        Control.switchIndic('off');
                    } else {
                        Control.switchIndic('on');
                    }
                });
            $('#chart_show_trade')
                .click(function () {
                    Kline.instance.toggleTrade();
                });
            
            $("#chart_tabbar li a")
                .click(function () {
                    $("#chart_tabbar li a").removeClass('selected');
                    $(this).addClass('selected');
                    let name = $(this).attr('name');
                    let tmp = ChartSettings.get();
                    tmp.charts.indics[1] = name;
                    ChartSettings.save();
                    if (Template.displayVolume === false)
                        ChartManager.instance.getChart().setIndicator(1, name);
                    else
                        ChartManager.instance.getChart().setIndicator(2, name);
                });
            $("#chart_select_chart_style a")
                .click(function () {
                    $("#chart_select_chart_style a").removeClass('selected');
                    $(this).addClass("selected");
                    let tmp = ChartSettings.get();
                    tmp.charts.chartStyle = $(this)[0].innerHTML;
                    ChartSettings.save();
                    let mgr = ChartManager.instance;
                    mgr.setChartStyle("frame0.k0", $(this).html());
                    mgr.redraw();
                });
            $('#chart_dropdown_themes li').click(function () {
                $('#chart_dropdown_themes li a').removeClass('selected');
                let name = $(this).attr('name');
                if (name === 'chart_themes_dark') {
                    Control.switchTheme('dark');
                } else if (name === 'chart_themes_light') {
                    Control.switchTheme('light');
                }
            });
            $("#chart_select_main_indicator a")
                .click(function () {
                    $("#chart_select_main_indicator a").removeClass('selected');
                    $(this).addClass("selected");
                    let name = $(this).attr('name');
                    let tmp = ChartSettings.get();
                    tmp.charts.mIndic = name;
                    ChartSettings.save();
                    let mgr = ChartManager.instance;
                    if (!mgr.setMainIndicator("frame0.k0", name))
                        mgr.removeMainIndicator("frame0.k0");
                    mgr.redraw();
                });
            $('#chart_toolbar_theme a').click(function () {
                $('#chart_toolbar_theme a').removeClass('selected');
                if ($(this).attr('name') === 'dark') {
                    Control.switchTheme('dark');
                } else if ($(this).attr('name') === 'light') {
                    Control.switchTheme('light');
                }
            });
            $('#chart_select_theme li a').click(function () {
                $('#chart_select_theme a').removeClass('selected');
                if ($(this).attr('name') === 'dark') {
                    Control.switchTheme('dark');
                } else if ($(this).attr('name') === 'light') {
                    Control.switchTheme('light');
                }
            });
            $('#chart_enable_tools li a').click(function () {
                $('#chart_enable_tools a').removeClass('selected');
                if ($(this).attr('name') === 'on') {
                    Control.switchTools('on');
                } else if ($(this).attr('name') === 'off') {
                    Control.switchTools('off');
                }
            });
            $('#chart_enable_indicator li a').click(function () {
                $('#chart_enable_indicator a').removeClass('selected');
                if ($(this).attr('name') === 'on') {
                    Control.switchIndic('on');
                } else if ($(this).attr('name') === 'off') {
                    Control.switchIndic('off');
                }
            });
            $('#chart_enable_trade li a').click(function () {
                $('#chart_enable_trade a').removeClass('selected');
                if ($(this).attr('name') === 'on') {
                    Kline.instance.setShowTrade(true);
                } else if ($(this).attr('name') === 'off') {
                    Kline.instance.setShowTrade(false);
                }
            });
            $('#chart_language_setting_div li a').click(function () {

                $('#chart_language_setting_div a').removeClass('selected');
                if ($(this).attr('name') === 'zh-cn') {
                    Control.chartSwitchLanguage('zh-cn');
                } else if ($(this).attr('name') === 'en-us') {

                    Control.chartSwitchLanguage('en-us');
                } else if ($(this).attr('name') === 'zh-tw') {
                    Control.chartSwitchLanguage('zh-tw');
                }
            });
            $(document).keyup(function (e) {
                if (e.keyCode === 46) {
                    ChartManager.instance.deleteToolObject();
                    ChartManager.instance.redraw('OverlayCanvas', false);
                }
            });
            $("#clearCanvas").click(function () {
                let pDPTool = ChartManager.instance.getDataSource("frame0.k0");
                let len = pDPTool.getToolObjectCount();
                for (let i = 0; i < len; i++) {
                    pDPTool.delToolObject();
                }
                ChartManager.instance.redraw('OverlayCanvas', false);
            });
            function getC(ev) {
                let x1=ev.targetTouches[0].pageX;
                let y1=ev.targetTouches[0].pageY;
                let x2=ev.targetTouches[1].pageX;
                let y2=ev.targetTouches[1].pageY;
                let a=x1-x2;
                let b=y1-y2;
                return Math.sqrt(a*a+b*b)//已知两个直角边开平方得出 斜角边
            }
            $("#chart_overlayCanvas")
                .on("touchstart", function(e) {
                    if (e.targetTouches.length==2) {
                        e.preventDefault();
                        Kline.instance.downC = getC(e);
                    } else if (e.targetTouches.length==1) {
                        e.preventDefault();
                        Kline.instance.buttonDown = true;
                        let r = e.target.getBoundingClientRect();
                        let x = e.touches[0].clientX - r.left;;
                        let y = e.touches[0].clientY - r.top;
                        ChartManager.instance.onMouseDown("frame0", x, y);
                        let mgr = ChartManager.instance;

                        mgr.onMouseMove("frame0", x, y, false);
                        mgr.redraw('OverlayCanvas', false);
                    }
                })
                .on("touchmove", function(e) {
                    if (e.targetTouches.length==2) {
                        e.preventDefault();
                        Control.mouseWheel(e,(getC(e)-Kline.instance.downC)/20000);
                    } else if (e.targetTouches.length==1) {
                        e.preventDefault();
                        let r = e.target.getBoundingClientRect();
                        let x = e.touches[0].clientX - r.left;
                        let y = e.touches[0].clientY - r.top;
                        let mgr = ChartManager.instance;
                        if (Kline.instance.buttonDown === true) {
                            mgr.onMouseMove("frame0", x, y, true);
                            mgr.redraw("All", false);
                        } else {
                            mgr.onMouseMove("frame0", x, y, false);
                            mgr.redraw("OverlayCanvas");
                        }
                    }
                })
                .on("touchend", function(e) {
                    e.preventDefault();
                    Kline.instance.buttonDown = false;
                    let r = e.target.getBoundingClientRect();
                    let x = e.changedTouches[0].clientX - r.left;;
                    let y = e.changedTouches[0].clientY - r.top;
                    let mgr = ChartManager.instance;
                    mgr.onMouseUp("frame0", x, y);
                    mgr.redraw("All");
                })
                .mousemove(function (e) {
                    let r = e.target.getBoundingClientRect();
                    let x = e.clientX - r.left;
                    let y = e.clientY - r.top;
                    let mgr = ChartManager.instance;
                    if (Kline.instance.buttonDown === true) {
                        mgr.onMouseMove("frame0", x, y, true);
                        mgr.redraw("All", false);
                    } else {
                        mgr.onMouseMove("frame0", x, y, false);
                        mgr.redraw("OverlayCanvas");
                    }
                })
                .mouseleave(function (e) {
                    let r = e.target.getBoundingClientRect();
                    let x = e.clientX - r.left;
                    let y = e.clientY - r.top;
                    let mgr = ChartManager.instance;
                    mgr.onMouseLeave("frame0", x, y, false);
                    mgr.redraw("OverlayCanvas");
                })
                .mouseup(function (e) {
                    if (e.which !== 1) {
                        return;
                    }
                    Kline.instance.buttonDown = false;
                    let r = e.target.getBoundingClientRect();
                    let x = e.clientX - r.left;
                    let y = e.clientY - r.top;
                    let mgr = ChartManager.instance;
                    mgr.onMouseUp("frame0", x, y);
                    mgr.redraw("All");
                })
                .mousedown(function (e) {
                    if (e.which !== 1) {
                        ChartManager.instance.deleteToolObject();
                        ChartManager.instance.redraw('OverlayCanvas', false);
                        return;
                    }
                    Kline.instance.buttonDown = true;
                    let r = e.target.getBoundingClientRect();
                    let x = e.clientX - r.left;
                    let y = e.clientY - r.top;
                    ChartManager.instance.onMouseDown("frame0", x, y);
                });
            $("#chart_parameter_settings :input").change(function () {
                let name = $(this).attr("name");
                let index = 0;
                let valueArray = [];
                let mgr = ChartManager.instance;
                $("#chart_parameter_settings :input").each(function () {
                    if ($(this).attr("name") === name) {
                        if ($(this).val() !== "" && $(this).val() !== null && $(this).val() !== undefined) {
                            let i = parseInt($(this).val());
                            valueArray.push(i);
                        }
                        index++;
                    }
                });
                if (valueArray.length !== 0) {
                    mgr.setIndicatorParameters(name, valueArray);
                    let value = mgr.getIndicatorParameters(name);
                    let cookieArray = [];
                    index = 0;
                    $("#chart_parameter_settings :input").each(function () {
                        if ($(this).attr("name") === name) {
                            if ($(this).val() !== "" && $(this).val() !== null && $(this).val() !== undefined) {
                                $(this).val(value[index].getValue());
                                cookieArray.push(value[index].getValue());
                            }
                            index++;
                        }
                    });
                    let tmp = ChartSettings.get();
                    tmp.indics[name] = cookieArray;
                    ChartSettings.save();
                    mgr.redraw('All', false);
                }
            });
            $("#chart_parameter_settings button").click(function () {
                let name = $(this).parents("tr").children("th").html();
                let index = 0;
                let value = ChartManager.instance.getIndicatorParameters(name);
                let valueArray = [];
                $(this).parent().prev().children('input').each(function () {
                    if (value !== null && index < value.length) {
                        $(this).val(value[index].getDefaultValue());
                        valueArray.push(value[index].getDefaultValue());
                    }
                    index++;
                });
                ChartManager.instance.setIndicatorParameters(name, valueArray);
                let tmp = ChartSettings.get();
                tmp.indics[name] = valueArray;
                ChartSettings.save();
                ChartManager.instance.redraw('All', false);
            });


            $('body').on('click', '#sizeIcon', function () {
                Kline.instance.sizeKline();
            });

            //emit the created event.
            Kline.instance.created();
        })

    }

}