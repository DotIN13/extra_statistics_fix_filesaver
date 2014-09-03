//-----------------------------------------------------------------------------
// [WoD] Extra Statistics
// Copyright (c) Fenghou, Tomy
// This script can generate additional statistical data in the dungeon and duel report pages.
// When you entered the details or statistics page of reports, a new button will appear beside
//   the details button. At the details page, the new button is "Extra Stat", which will show
//   the statistics of the current level when you click it. At the statistics page, the new
//   button is "Entire Extra Stat", which will show the statistics of entire dungeon.
//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------
// If you want to add a new Stat table, you should create a new sub class of CInfoList,
//   and use CStat::RegInfoList() to register your new info list.
// A detailed example is CILItemDamage.
//-----------------------------------------------------------------------------
// ==UserScript==
// @name			Extra Statistics
// @namespace		fenghou
// @version			2.0
// @description		Generate additional statistical data in the dungeon and duel report pages
// @include			http*://*.world-of-dungeons.*/wod/spiel/*dungeon/report.php*
// @include			http*://*.world-of-dungeons.*/wod/spiel/tournament/*duell.php*
// @require			https://raw.githubusercontent.com/eligrey/Blob.js/master/Blob.js
// @require			https://raw.githubusercontent.com/eligrey/FileSaver.js/master/FileSaver.js
// @require			https://raw.githubusercontent.com/Stuk/jszip/master/dist/jszip.js
// @require			http://malsup.github.com/jquery.form.js
// @updateURL		https://bitbucket.org/wod/extra_statistics/raw/with_report_export/scripts/extra_statistics.user.js
// @downloadURL		https://bitbucket.org/wod/extra_statistics/raw/with_report_export/scripts/extra_statistics.user.js
// ==/UserScript==
(function() {
    // COMMON FUNCTIONS ///////////////////////////////////////////////////////////

    // Choose contents of the corresponding language
    // Contents: {Name1 : [lang1, lang2, ...], Name2 : [lang1, lang2, ...], ...}
    // return: Local contents, or null
    // It will edit the input contents directly, so the returned object is not necessary
    function GetLocalContents(Contents) {
        function GetLanguageId() {
            var langText = null;
            var allMetas = document.getElementsByTagName("meta");
            for (var i = 0; i < allMetas.length; ++i) {
                if (allMetas[i].httpEquiv == "Content-Language") {
                    langText = allMetas[i].content;
                    break;
                }
            }
            if (langText == null)
                return false;

            switch (langText) {
                case "en":
                    return 0;
                case "cn":
                    return 1;
                default:
                    return null;
            }
        }

        var nLangId = GetLanguageId();
        if (nLangId == null)
            return null;

        if (Contents instanceof Object) {
            for (var name in Contents)
                Contents[name] = Contents[name][nLangId];
            return Contents;
        } else
            return null;
    }


    function CompareString(a, b) {
        a = a || "";
        b = b || "";
        return a.toLowerCase().localeCompare(b.toLowerCase(),"zh-CN-u-co-pinyin");
    }


    function CreateElementHTML(Name, Content /* , [AttrName1, AttrValue1], [AttrName2, AttrValue2], ... */ ) {
        var HTML = '<' + Name;

        for (var i = 2; i < arguments.length; ++i)
            HTML += ' ' + arguments[i][0] + '="' + arguments[i][1] + '"';

        HTML += (Content != null && Content != "") ? ('>' + Content + '</' + Name + '>') : (' />');

        return HTML;
    }


    function DbgMsg(Text) {
        if (DEBUG) alert(Text);
    }

    if (!Array.prototype.indexOf) {
        Array.prototype.indexOf = function(needle) {
            for (var i = 0; i < this.length; i++) {
                if (this[i] === needle) {
                    return i;
                }
            }
            return -1;
        };
    }


    // COMMON STAT FUNCTIONS ///////////////////////////////////////////////////////////

    function getSum(numArr) {
        var nTotal = 0;
        for (var i = 0; i < numArr.length; i++) {
            nTotal = nTotal + Number(numArr[i])
        };
        return nTotal;
    }

    function getAverage(numArr) {
            return (getSum(numArr) / numArr.length);
        }
        // see http://www.johndcook.com/blog/2008/09/26/comparing-three-methods-of-computing-standard-deviation/
        // for discussion on choice of algorithm

    function getVariance(numArr) {
        if (numArr.length <= 1) {
            return 0
        };
        var nAvg = getAverage(numArr);
        var nTempSum = 0;
        for (var i = 0; i < numArr.length; i++) {
            nTempSum = nTempSum + Math.pow((Number(numArr[i]) - nAvg), 2);
        };
        return (nTempSum / (numArr.length - 1));
    }

    // sample standard deviation
    function getSTD(numArr) {
        return Number(Math.sqrt(getVariance(numArr)).toFixed(2));
    }

    function getMax(numArr) {
        return Math.max.apply(null, numArr);
    }

    function getMin(numArr) {
        return Math.min.apply(null, numArr);
    }

    // EXTERN FUNCTIONS ///////////////////////////////////////////////////////////

    /**
     * A utility function for defining JavaScript classes.
     *
     * This function expects a single object as its only argument.  It defines
     * a new JavaScript class based on the data in that object and returns the
     * constructor function of the new class.  This function handles the repetitive
     * tasks of defining classes: setting up the prototype object for correct
     * inheritance, copying methods from other types, and so on.
     *
     * The object passed as an argument should have some or all of the
     * following properties:
     *
     *      name: The name of the class being defined.
     *            If specified, this value will be stored in the classname
     *            property of the prototype object.
     *
     *    extend: The constructor of the class to be extended. If omitted,
     *            the Object( ) constructor will be used. This value will
     *            be stored in the superclass property of the prototype object.
     *
     * construct: The constructor function for the class. If omitted, a new
     *            empty function will be used. This value becomes the return
     *            value of the function, and is also stored in the constructor
     *            property of the prototype object.
     *
     *   methods: An object that specifies the instance methods (and other shared
     *            properties) for the class. The properties of this object are
     *            copied into the prototype object of the class. If omitted,
     *            an empty object is used instead. Properties named
     *            "classname", "superclass", and "constructor" are reserved
     *            and should not be used in this object.
     *
     *   statics: An object that specifies the static methods (and other static
     *            properties) for the class. The properties of this object become
     *            properties of the constructor function. If omitted, an empty
     *            object is used instead.
     *
     *   borrows: A constructor function or array of constructor functions.
     *            The instance methods of each of the specified classes are copied
     *            into the prototype object of this new class so that the
     *            new class borrows the methods of each specified class.
     *            Constructors are processed in the order they are specified,
     *            so the methods of a class listed at the end of the array may
     *            overwrite the methods of those specified earlier. Note that
     *            borrowed methods are stored in the prototype object before
     *            the properties of the methods object above. Therefore,
     *            methods specified in the methods object can overwrite borrowed
     *            methods. If this property is not specified, no methods are
     *            borrowed.
     *
     *  provides: A constructor function or array of constructor functions.
     *            After the prototype object is fully initialized, this function
     *            verifies that the prototype includes methods whose names and
     *            number of arguments match the instance methods defined by each
     *            of these classes. No methods are copied; this is simply an
     *            assertion that this class "provides" the functionality of the
     *            specified classes. If the assertion fails, this method will
     *            throw an exception. If no exception is thrown, any
     *            instance of the new class can also be considered (using "duck
     *            typing") to be an instance of these other types.  If this
     *            property is not specified, no such verification is performed.
     **/
    function DefineClass(data) {
        // Extract the fields we'll use from the argument object.
        // Set up default values.
        var classname = data.name;
        var superclass = data.extend || Object;
        var constructor = data.construct || function() {};
        var methods = data.methods || {};
        var statics = data.statics || {};
        var borrows;
        var provides;

        // Borrows may be a single constructor or an array of them.
        if (!data.borrows) borrows = [];
        else if (data.borrows instanceof Array) borrows = data.borrows;
        else borrows = [data.borrows];

        // Ditto for the provides property.
        if (!data.provides) provides = [];
        else if (data.provides instanceof Array) provides = data.provides;
        else provides = [data.provides];

        // Create the object that will become the prototype for our class.
        var proto = new superclass();

        // Delete any noninherited properties of this new prototype object.
        for (var p in proto)
            if (proto.hasOwnProperty(p)) delete proto[p];

            // Borrow methods from "mixin" classes by copying to our prototype.
        for (var i = 0; i < borrows.length; i++) {
            var c = data.borrows[i];
            borrows[i] = c;
            // Copy method properties from prototype of c to our prototype
            for (var p in c.prototype) {
                if (typeof c.prototype[p] != "function") continue;
                proto[p] = c.prototype[p];
            }
        }
        // Copy instance methods to the prototype object
        // This may overwrite methods of the mixin classes
        for (var p in methods) proto[p] = methods[p];

        // Set up the reserved "constructor", "superclass", and "classname"
        // properties of the prototype.
        proto.constructor = constructor;
        proto.superclass = superclass;
        // classname is set only if a name was actually specified.
        if (classname) proto.classname = classname;

        // Verify that our prototype provides all of the methods it is supposed to.
        for (var i = 0; i < provides.length; i++) { // for each class
            var c = provides[i];
            for (var p in c.prototype) { // for each property
                if (typeof c.prototype[p] != "function") continue; // methods only
                if (p == "constructor" || p == "superclass") continue;
                // Check that we have a method with the same name and that
                // it has the same number of declared arguments.  If so, move on
                if (p in proto &&
                    typeof proto[p] == "function" &&
                    proto[p].length == c.prototype[p].length) continue;
                // Otherwise, throw an exception
                throw new Error("Class " + classname + " does not provide method " +
                    c.classname + "." + p);
            }
        }

        // Associate the prototype object with the constructor function
        constructor.prototype = proto;

        // Copy static properties to the constructor
        for (var p in statics) constructor[p] = statics[p];

        // Finally, return the constructor function
        return constructor;
    }


    /**
     * Throughout, whitespace is defined as one of the characters
     *  "\t" TAB \u0009
     *  "\n" LF  \u000A
     *  "\r" CR  \u000D
     *  " "  SPC \u0020
     *
     * This does not use Javascript's "\s" because that includes non-breaking
     * spaces (and also some other characters).
     */


    /**
     * Determine whether a node's text content is entirely whitespace.
     *
     * @param nod  A node implementing the |CharacterData| interface (i.e.,
     *             a |Text|, |Comment|, or |CDATASection| node
     * @return     True if all of the text content of |nod| is whitespace,
     *             otherwise false.
     */
    function is_all_ws(nod) {
        // Use ECMA-262 Edition 3 String and RegExp features
        return !(/[^\t\n\r ]/.test(nod.data));
    }


    /**
     * Determine if a node should be ignored by the iterator functions.
     *
     * @param nod  An object implementing the DOM1 |Node| interface.
     * @return     true if the node is:
     *                1) A |Text| node that is all whitespace
     *                2) A |Comment| node
     *             and otherwise false.
     */

    function is_ignorable(nod) {
        return (nod.nodeType == Node.COMMENT_NODE) || // A comment node
            ((nod.nodeType == Node.TEXT_NODE) && is_all_ws(nod)); // a text node, all ws
    }

    /**
     * Version of |previousSibling| that skips nodes that are entirely
     * whitespace or comments.  (Normally |previousSibling| is a property
     * of all DOM nodes that gives the sibling node, the node that is
     * a child of the same parent, that occurs immediately before the
     * reference node.)
     *
     * @param sib  The reference node.
     * @return     Either:
     *               1) The closest previous sibling to |sib| that is not
     *                  ignorable according to |is_ignorable|, or
     *               2) null if no such node exists.
     */
    function node_before(sib) {
        while ((sib = sib.previousSibling)) {
            if (!is_ignorable(sib)) return sib;
        }
        return null;
    }

    /**
     * Version of |nextSibling| that skips nodes that are entirely
     * whitespace or comments.
     *
     * @param sib  The reference node.
     * @return     Either:
     *               1) The closest next sibling to |sib| that is not
     *                  ignorable according to |is_ignorable|, or
     *               2) null if no such node exists.
     */
    function node_after(sib) {
        while ((sib = sib.nextSibling)) {
            if (!is_ignorable(sib)) return sib;
        }
        return null;
    }

    /**
     * Version of |lastChild| that skips nodes that are entirely
     * whitespace or comments.  (Normally |lastChild| is a property
     * of all DOM nodes that gives the last of the nodes contained
     * directly in the reference node.)
     *
     * @param par  The reference node.
     * @return     Either:
     *               1) The last child of |sib| that is not
     *                  ignorable according to |is_ignorable|, or
     *               2) null if no such node exists.
     */
    function last_child(par) {
        var res = par.lastChild;
        while (res) {
            if (!is_ignorable(res)) return res;
            res = res.previousSibling;
        }
        return null;
    }

    /**
     * Version of |firstChild| that skips nodes that are entirely
     * whitespace and comments.
     *
     * @param par  The reference node.
     * @return     Either:
     *               1) The first child of |sib| that is not
     *                  ignorable according to |is_ignorable|, or
     *               2) null if no such node exists.
     */
    function first_child(par) {
        var res = par.firstChild;
        while (res) {
            if (!is_ignorable(res)) return res;
            res = res.nextSibling;
        }
        return null;
    }

    /**
     * Version of |data| that doesn't include whitespace at the beginning
     * and end and normalizes all whitespace to a single space.  (Normally
     * |data| is a property of text nodes that gives the text of the node.)
     *
     * @param txt  The text node whose data should be returned
     * @return     A string giving the contents of the text node with
     *             whitespace collapsed.
     */
    function data_of(txt) {
        var data = txt.data;
        // Use ECMA-262 Edition 3 String and RegExp features
        data = data.replace(/[\t\n\r ]+/g, " ");
        if (data.charAt(0) == " ")
            data = data.substring(1, data.length);
        if (data.charAt(data.length - 1) == " ")
            data = data.substring(0, data.length - 1);
        return data;
    }


    // CLASSES ////////////////////////////////////////////////////////////////////

    // NextNode: the node next to the statistics node when it is created
    function CStat(NextNode) {
        this._HTML = '';

        this._gInfoList = [];

        this.nTotalPages = 0;
        this.nReadPages = 0;
        this.setNode = function(newNode) {
            var NewSection = document.createElement("div");
            NewSection.id = "stat_all";
			NewSection.className = "stat_all";
            if (newNode.parentNode)
                this._Node = newNode.parentNode.insertBefore(NewSection, newNode);
            else {
                this._Node = NewSection;
                newNode.appendChild(NewSection);
            }
			this._HTML = '';
        };
        this.setNode(NextNode);
    }

    CStat.prototype._Write = function(Text) {
        this._HTML += Text;
    };

    CStat.prototype._Flush = function() {
        this._Node.innerHTML = this._HTML;
    };

    CStat.prototype.RegInfoList = function(InfoList) {
        if (InfoList instanceof CInfoList) {
            this._gInfoList.push(InfoList);
            return true;
        }
        return false;
    };

    CStat.prototype.SaveInfo = function(Info) {
        for (var i = 0; i < this._gInfoList.length; ++i)
            this._gInfoList[i].SaveInfo(Info);
    };

    CStat.prototype.Show = function() {
        this._Write("<hr />");
        for (var i = 0; i < this._gInfoList.length; ++i)
            this._Write(this._gInfoList[i].Show());
        this._Write(this._OptionsHTML());
        this._Write("<hr />");
        this._Flush();

        for (var i = 0; i < this._gInfoList.length; ++i)
            this._gInfoList[i].AddEvents();
        this._AddEvents();
    };

    CStat.prototype.Export = function() {
        this._Write("<hr />");
        for (var i = 0; i < this._gInfoList.length; ++i)
            this._Write(this._gInfoList[i].Export());
        this._Write("<hr />");
        this._Flush();
    };

    CStat.prototype.ShowProgress = function() {
        this._Node.innerHTML = '<hr /><h1>' + Local.Text_Loading + ' (' +
            this.nReadPages + '/' + this.nTotalPages + ') ...</h1><hr />';
    };

    CStat.prototype._OptionsHTML = function() {
        var Str = '<div id="stat_options">' +
            '<div class="stat_header"><span class="stat_title">' + Local.Text_Options + '</span>';
        Str += CreateElementHTML("input", null, ["type", "button"], ["class", "button"], ["id", "stat_options_default"], ["value", Local.Text_Button_Default]);
        Str += '</div></div>';
        return Str;
    };

    CStat.prototype._AddEvents = function() {
        function OnDelGMValues() {
            try {
                var ValueList = GM_listValues();
                for (var name in ValueList) {
                    GM_deleteValue(ValueList[name]);
                }
                alert(Local.Text_DefaultMsg);
            } catch (e) {
                alert("OnDelGMValues(): " + e);
            }
        }
        document.getElementById("stat_options_default").addEventListener("click", OnDelGMValues, false);
    };


    ///////////////////////////////////////////////////////////////////////////////
    function CTable(Title, Id, nColumns, isExport) {
        this._Title = Title;
        this._Id = Id;
		this._filterId = "filter_" + Id;
        this._nColumns = nColumns;
        this._HeadCellContents = new Array(nColumns);
        this._BodyCellContentTypes = new Array(nColumns);
		this._HeadCellContentFilters = [];
        this._BodyCellContents = [];
        this._HTML = '';
        this._isExport = isExport;
        this._bShow = GM_getValue(Id, true);
    }

    CTable._ContentAttrs = {
        string: '',
        number: 'align="right"',
        button: 'align="center"'
    };

    CTable.prototype.SetHeadCellContentFilters = function( /* Content1, Content2, ... */ ) {
		for (var i = 0; i < arguments.length; ++i)
            if(arguments[i] != null)
				this._HeadCellContentFilters.push(arguments[i]);
    };

	CTable.prototype.SetHeadCellContents = function( /* Content1, Content2, ... */ ) {
        for (var i = 0; i < this._nColumns; ++i)
            this._HeadCellContents[i] = arguments[i] != null ? arguments[i] : "";
    };

    // Type: a string that is the property name of CTable::ContentAttrs
    CTable.prototype.SetBodyCellContentTypes = function( /* Type1, Type2, ... */ ) {
        for (var i = 0; i < this._nColumns; ++i)
            this._BodyCellContentTypes[i] =
            arguments[i] != null ? CTable._ContentAttrs[arguments[i]] : "";
    };

    CTable.prototype.SetBodyCellContents = function( /* Content1, Content2, ... */ ) {
        var Contents = new Array(this._nColumns);
        for (var i = 0; i < this._nColumns; ++i)
            Contents[i] = arguments[i] != null ? arguments[i] : "";
        this._BodyCellContents.push(Contents);
    };

    CTable.prototype.CreateHTML = function() {
        //var exportString = ' onclick="if(this.parentNode.nextSibling.style.display == ' + "'none' ){this.parentNode.nextSibling.style.display='';} else {this.parentNode.nextSibling.style.display='none'" + '};"';
		var tableid = "table_" + this._Id
        exportString = ' onclick="ct('+ "'" + tableid + "');" +'"';
		if (!this._isExport)
            exportString = "";
        this._HTML = '<div id="' + this._Id + '">' +
            '<div class="stat_header"><span class="stat_title clickable"' + exportString + '>' + this._Title + '</span></div>' +
            '<table class="content_table" id="' + tableid + '" ' + (this._bShow ? '' : 'hide="hide"') + '>' +
			'<tr class="content_table_header">';

        for (var i = 0; i < this._nColumns; ++i)
		{
            exportString = ' onclick="co('+ "'" + tableid + "'," + i +",0);" +'"';
			if (!this._isExport)
				exportString = "";
			var headerText = '<span id="' + this._Id + "_col" + i + '" class="clickable" ' + exportString + '>' + this._HeadCellContents[i] + '<span><span';
			this._HTML += '<th class="content_table stat_order" id="th_' + this._Id + i + '" order="1" >' + headerText + '</th>';
		}
        this._HTML += '</tr>';
		if(useFilter)
		{
			this._HTML += '<tr id="' + this._filterId + '" class="content_table_filter_row">';
			for (var i = 0; i < this._nColumns-1; ++i)
			{
				this._HTML += '<td>';
				if(this._HeadCellContentFilters != null)
				{
					if(this._HeadCellContentFilters[i] != null)
					{
						var filter = this._HeadCellContentFilters[i];
						var comboxboxid = this._filterId + "_combobox_" + i ;
						this._HTML += '<select id="' + comboxboxid + '"';
						if(this._isExport)
							this._HTML += ' onchange="cf(' +"'" + tableid + "','" + this._filterId + "'" + ');"';
						this._HTML += '>';
						this._HTML += '<option value="' + i + '_' + 'all" >' + Local.Text_Table_AllData + '</option>';
						for(var j=0;j<filter.length;j++)
						{
							this._HTML += '<option value="' + i + '_' + j + '">' + filter[j] + '</option>';
						}
						this._HTML += '</select>';
					}
					else
					{
						this._HTML += '<input type="text" id="' + this._filterId + "_textbox_" + i + '" size="8">';
					}
				}
				this._HTML += '</td>';
			}
			this._HTML += '<td><input type="button" class="button" value="查询" id="' + this._filterId + "_button" + '"';
			if(this._isExport)
				this._HTML += ' onclick="cf(' +"'" + tableid + "','" + this._filterId + "'" +  ');"';
			this._HTML += '></td></tr>';
		}
		
        for (var i = 0; i < this._BodyCellContents.length; ++i) {
            this._HTML += '<tr class="row' + i % 2 + '" oriorder="' + i + '"';
			var rowStr = "";
			var rowId = [];
            for (var j = 0; j < this._nColumns; ++j) {
				var rowspan = "";
				var content = this._BodyCellContents[i][j];
                if(content.show)
				{
					if(content.rowspan > 1)
						rowspan = ' rowspan="' + content.rowspan + '" style="vertical-align: middle;" ';
					rowStr += '<td class="content_table" ' + rowspan + 
						this._BodyCellContentTypes[j] + '>' +
						this._BodyCellContents[i][j].value + '</td>';
				}
				rowId.push(j + "_" + this._BodyCellContents[i][j].filterId);
            }
			this._HTML += '" id = "' + rowId.join(",") + '">' + rowStr + '</tr>';
        }
        this._HTML += '</table></div>';

        return this._HTML;
    };

    CTable.prototype.GetHTML = function() {
        return this._HTML;
    };

    CTable.prototype.AddEvents = function() {
        var node = document.getElementById(this._Id);
        if (!node)
            return;
		var tableId = "table_" + this._Id;
		var filterRowId = "filter_" + this._Id;
        var Title = node.getElementsByTagName("span")[0];

        function Factory(Id) {
            return function() {
                CTable.OnClickTitle(Id);
            };
		}

        function FactoryFilter(tableId,rowId) {
            return function() {
                CTable.OnChangeFilter(tableId,rowId);
            };
		}
        function FactorySort(tableId,colId,numberId) {
            return function() {
                CTable.OnChangeOrder(tableId,colId,numberId);
            };
		}

        Title.addEventListener("click", Factory(tableId), false);
		
		if(useFilter)
		{
			var filterRow = document.getElementById(filterRowId);
			var buttonid = filterRowId + "_button";
			var filterbutton = document.getElementById(buttonid);
			if(filterbutton)
				filterbutton.addEventListener("click", FactoryFilter(tableId,filterRowId), false);
			for(var i = 0; i< filterRow.cells.length; i++)
			{
				var cell = filterRow.cells[i];
				var comboboxid = filterRowId + "_combobox_" + i;
				var comboboxfilter = document.getElementById(comboboxid);
				if(comboboxfilter)
					comboboxfilter.addEventListener("change", FactoryFilter(tableId,filterRowId), false);
			}
		}
		var ths = node.getElementsByTagName("th");
		for(var i=0; i< ths.length;i++)
		{
			var order = ths[i].getAttribute("order");
			ths[i].addEventListener("click", FactorySort(tableId,i,0), false);			
		}
	};

    CTable.OnClickTitle = function(Id) {
        try {
            var Table = document.getElementById(Id);
            if (Table.hasAttribute("hide")) {
                Table.removeAttribute("hide");
				if(this.GM_getValue)
					GM_setValue(Id, true);
            } else {
                Table.setAttribute("hide", "hide");
				if(this.GM_getValue)
					GM_setValue(Id, false);
            }
        } catch (e) {
            alert("CTable.OnClickTitle(): " + e);
        }
    };
	
	CTable.GetNumber = function(cell) {
		var numberPatten = /^\s?([\d]+\.?[\d]*)\s?_?\s?([\d]*\.?[\d]*)\s?$/;
		var pairTable = cell.firstChild;
		var numberString = cell.textContent;
		if(pairTable && pairTable.nodeName == "TABLE")
		{
			numberString = pairTable.id;
		}
		if(!numberPatten.test(numberString))
			null;
		else
		{
			var numberres = numberPatten.exec(numberString);
			var numbers = [];
			if(numberres[1])
				numbers.push(numberres[1]);
			if(numberres[2])
				numbers.push(numberres[2]);
			return numbers;
		}
	}
	CTable.OnChangeFilter = function(tableId,filterRowId) {
        try {
            var Table = document.getElementById(tableId);
			var filterRow = document.getElementById(filterRowId);
			var stringfilters = [];
			var numberfilters = [];
			var filterString = "";
			for(var i = 0; i< filterRow.cells.length; i++)
			{
				var cell = filterRow.cells[i];
				var stringfilter = document.getElementById(filterRow.id + "_combobox_" + i);
				var numberfilter = document.getElementById(filterRow.id + "_textbox_" + i);
				if(stringfilter)
					stringfilters.push(stringfilter.value);
				else
					stringfilters.push(null);
				if(numberfilter)
					numberfilters.push(numberfilter.value);
				else
					numberfilters.push(null);
			}
			var index = 0;
			var patten = /([\(|\[|>|<|=|]*)\s*([\d]*\.?[\d]*)\s*-?\s*([\d]*\.?[\d]*)\s*([\)|\]|\s]?)/;
			for(var i = 2;i< Table.rows.length;i++)
			{
				var row = Table.rows[i];
				var rowIds = row.id.split(",");
				var show = true;
				for(var fi =0; fi<stringfilters.length;fi++)
				{
					var sfiler = stringfilters[fi];
					if(!sfiler)
						continue;
					if(sfiler != fi + "_all" && sfiler != rowIds[fi])
					{
						show = false;
						break;
					}
				}
				if(show)
				{
					for(fi=0;fi<numberfilters.length;fi++)
					{
						var nfilter = numberfilters[fi];
						
						if(!nfilter)
							continue;
						else 
						{
							var numbers = CTable.GetNumber(row.cells[fi])|[];
							var nfilters = nfilter.split(/\s*[,|，]\s*/);
							for(ni = 0; ni < numbers.length; ni++)
							{
								var theFilter = nfilters[ni];
								var testString = "";
								if(theFilter && patten.test(theFilter))
								{
									var	op = "==";
									var res = patten.exec(theFilter);
									if(res[1])
									{
										op = res[1];
										if(res[3])
										if( op == "[") op = ">=";
										if( op == "(") op = ">";
										if( op == "=") op = "==";
									}
									else
									{
										if(res[3])
											op = ">=";
									}
									testString = numbers[ni] + op + res[2];
									if(res[3])
									{
										op = "<=";
										if(res[4])
										{
											op = res[4]
											if( op == "]") op = "<=";
											if( op == ")") op = "<";
										}
										testString += " && " + numbers[ni] + op + res[3];
									}
									show = eval(testString);
									if(!show)
										break;
								}
							}
						}
						if(!show)
							break;
					}
				}
				row.style.display = show? '':'none';
				if(show)
				{
					row.className = "row" + index % 2;
					index++;
				}
				
			}
        } catch (e) {
            alert("CTable.OnChangeFilter(): " + e);
        }
    };

    CTable.OnChangeOrder = function(tableId,columnIndex,numberIndex) {
		var Table = document.getElementById(tableId);
		var index = numberIndex;
		var ths = Table.getElementsByTagName("th");
		if(index == null)
			index = 0;
		var th = ths[columnIndex];
		var order = th.getAttribute("order");
		for(var i = 2;i< Table.rows.length-1;i++)
		{
			for(var j = i+1;j< Table.rows.length;j++)
			{
				var row_1 = Table.rows[i];
				var row_2 = Table.rows[j];
				var cell_1 = row_1.cells[columnIndex];
				var cell_2 = row_2.cells[columnIndex];
				
				n1 = CTable.GetNumber(cell_1);
				n2 = CTable.GetNumber(cell_2);
				var change = false;
				if(n1 && n2)
				{
					var number_1 = n1[index] * order;
					var number_2 = n2[index] * order;
					change = number_1 > number_2;
				}
				else
				{
					if(columnIndex == ths.length -1)
					{
						var n1 = Number(row_1.getAttribute("oriorder"));
						var n2 = Number(row_2.getAttribute("oriorder"));
						change = n1>n2;
					}
					else
					{
						var c1 = "";
						var c2 = "";
						if(columnIndex == 0)
						{
							c1 = cell_1.firstChild.className.replace("my","");
							c2 = cell_2.firstChild.className.replace("my","");
						}
						var s1 = cell_1.textContent;
						var s2 = cell_2.textContent;
						var cc = CompareString(c1,c2);
						if(cc < 0)
							change = false;
						else if(cc > 0)
							change = true;
						else if( CompareString(s1,s2) == order)
							change = true;
					}
				}
				if(change)
					row_1.parentNode.insertBefore(row_2,row_1);
			}
			Table.rows[i].className = "row" + i % 2;
		}
		th.setAttribute("order",-1*order);
	};
    ///////////////////////////////////////////////////////////////////////////////
    function CActiveInfo() {
        this.nIniRoll;
        this.nCurrAction;
        this.nTotalActions;
        this.Char = new CChar();
        this.nCharId;
        this.ActionType = new CActionType();
        this.Skill = new CSkill();
        this.gAttackRoll;
        this.gPosition = new CKeyList();
        this.nSkillMP;
        this.nSkillHP;
        this.gItem = new CKeyList();
    }


    function CPassiveInfo() {
        this.Char = new CChar();
        this.nCharId;
        this.Skill = new CSkill();
        this.nDefenceRoll;
        this.nSkillMP;
        this.gItem = new CKeyList();
        this.HitType = new CHitType();
        this.bStruckDown;
        this.gDamage = [];
        this.DamagedItem = new CItem();
        this.nItemDamage;
        this.nHealedHP;
        this.nHealedMP;
    }


    function CNavi(nLevel, nRoom, nRound, nRow) {
        this.nLevel = nLevel;
        this.nRoom = nRoom;
        this.nRound = nRound;
        this.nRow = nRow;
    }


    function CActionInfo(Navi) {
        this.Navi = Navi;
        this.Active = new CActiveInfo();
        this.gPassive = [];
    }

    ///////////////////////////////////////////////////////////////////////////////
    // Class: Key
    // Every key should have two function properties: compareTo() and toString(),
    //   and can work without initialization parameters

    var CKey = DefineClass({
        methods: {
            compareTo: function(that) {
                return this - that;
            },
            toString: function() {
                return "";
            },
			toText: function() {
				return this.toString();
			}
        }
    });


    var CKeyList = DefineClass({
        extend: CKey,
        construct: function() {
            this._gKey = [];
        },
        methods: {
            push: function(Key) {
                return this._gKey.push(Key);
            },
            compareTo: function(that) {
                var result = this._gKey.length - that._gKey.length;
                if (result !== 0)
                    return result;

                var i = 0;
                while (i < this._gKey.length && this._gKey[i].compareTo(that._gKey[i]) === 0)
                    ++i;
                if (i === this._gKey.length)
                    return 0;
                else
                    return this._gKey[i].compareTo(that._gKey[i]);
            },
            toString: function() {
                return this._gKey.join(", ");
            }
        }
    });


    var CChar = DefineClass({
        extend: CKey,
        construct: function(HTMLElement) {
            this._Name;
            this._Href;
            this._OnClick;
            this._Class;
            this._nType;

            if (HTMLElement != null) {
                this._Name = HTMLElement.firstChild.data;
                this._Href = HTMLElement.getAttribute("href");
                this._OnClick = HTMLElement.getAttribute("onclick");
                this._Class = HTMLElement.className;
                this._nType = CChar._GetCharType(this._Class);
                if (this._nType === null)
                    DbgMsg("CChar(): Unknown type: " + this._Class);
            }
        },
        methods: {
			GetType: function() {
                return this._nType;
            },
            compareTo: function(that) {
                var result = this._nType - that._nType;
                if (result !== 0)
                    return result;
                return CompareString(this._Name, that._Name);
            },
            toString: function() {
                if (this._Name != null)
                    return CreateElementHTML("a", this._Name, ["href", this._Href], ["onclick", this._OnClick], ["class", this._Class]);
                else
                    return "";
            },
			toText: function() {
				return this._Name != null? this._Name : "";
			}
        },
        statics: {
            _GetCharType: function(Class) {
                switch (Class) {
                    case "rep_hero":
                    case "rep_myhero":
                        return CChar.HERO;
                    case "rep_monster":
                    case "rep_myhero_defender":
                        return CChar.MONSTER;
                    default:
                        return null;
                }
            }
        }
    });
    CChar.HERO = 0;
    CChar.MONSTER = 1;

    // Attack position
    var CPositionType = DefineClass({
        extend: CKey,
        construct: function(PositionText) {
            this._sType;

            if (PositionText != null) {
                this._sType = PositionText;
            }
        },
        methods: {
            GetType: function() {
                return this._sType;
            },
            compareTo: function(that) {
                return CompareString(this._sType, that._sType);
            },
            toString: function() {
                return this._sType;
            }
        }
    });


    // In-round actions
    var CActionType = DefineClass({
        extend: CKey,
        construct: function(ActionText) {
            this._sType;
            this._nKind;


            if (ActionText != null) {
                this._sType = ActionText;
                this._nKind = CActionType._GetActionKind(ActionText);
            }
        },
        methods: {
            GetType: function() {
                return this._sType;
            },
            GetKind: function() {
                return this._nKind;
            },
            compareTo: function(that) {
                return CompareString(this._sType, that._sType);
            },
            toString: function() {
                switch (this._nKind) {
                    case CActionType.ATTACK:
                        return Local.TextList_AttackType[Local.OrigTextList_AttackActionType.indexOf(this._sType)];
                    case CActionType.HEAL:
                        return Local.TextList_HealType;
                    case CActionType.BUFF:
                        return Local.TextList_BuffType;
                    case CActionType.WAIT:
                        return Local.TextList_WaitType;
                    default:
                        return "unknown";
                }
            }
        },
        statics: {
            _GetActionKind: function(ActionText) {
                if (Local.OrigTextList_AttackActionType.indexOf(ActionText) > -1)
                    return CActionType.ATTACK;
                if (Local.OrigTextList_HealActionType.indexOf(ActionText) > -1)
                    return CActionType.HEAL;
                if (Local.OrigTextList_BuffActionType.indexOf(ActionText) > -1)
                    return CActionType.BUFF;
                if (Local.OrigTextList_WaitActionType.indexOf(ActionText) > -1)
                    return CActionType.WAIT;
                return CActionType.UNKNOWN;
            }
        }
    });
    CActionType.ATTACK = 0;
    CActionType.HEAL = 1;
    CActionType.BUFF = 2;
    CActionType.WAIT = 3;
    CActionType.UNKNOWN = 4;

    var CSkill = DefineClass({
        extend: CKey,
        construct: function(HTMLElement) {
            this._Name;
            this._Href;
            this._OnClick;

            if (HTMLElement != null) {
                this._Name = HTMLElement.firstChild.data;
                this._Href = HTMLElement.getAttribute("href");
                this._OnClick = HTMLElement.getAttribute("onclick");
            }
        },
        methods: {
            compareTo: function(that) {
                return CompareString(this._Name, that._Name);
            },
            toString: function() {
                if (this._Name != null)
                    return CreateElementHTML("a", this._Name, ["href", this._Href], ["onclick", this._OnClick]);
                else
                    return "";
            },
			toText: function() {
				return this._Name != null? this._Name : "";
			}
        }
    });


    var CItem = DefineClass({
        extend: CKey,
        construct: function(HTMLElement) {
            this._Name;
            this._Href;
            this._OnClick;
            this._Class;

            if (HTMLElement != null) {
                this._Name = HTMLElement.firstChild.data;
                this._Href = HTMLElement.getAttribute("href");
                this._OnClick = HTMLElement.getAttribute("onclick");
                this._Class = HTMLElement.className;
            }
        },
        methods: {
            compareTo: function(that) {
                return CompareString(this._Name, that._Name);
            },
            toString: function() {
                if (this._Name != null)
                    return CreateElementHTML("a", this._Name, ["href", this._Href], ["onclick", this._OnClick], ["class", this._Class]);
                else
                    return "";
            },
 			toText: function() {
				return this._Name != null? this._Name : "";
			}
       }
    });


    var CHitType = DefineClass({
        extend: CKey,
        construct: function(HitClassText) {
            this._nType;

            if (HitClassText != null) {
                this._nType = CHitType._GetHitType(HitClassText);
                if (this._nType === null)
                    DbgMsg("CHitType(): Unknown type: " + HitClassText);
            }
        },
        methods: {
            GetType: function() {
                return this._nType;
            },
            compareTo: function(that) {
                return this._nType - that._nType;
            },
            toString: function() {
                if (this._nType != null)
                    return Local.TextList_HitType[this._nType];
                else
                    return "";
            }
        },
        statics: {
            _GetHitType: function(Class) {
                switch (Class) {
                    case "rep_miss":
                        return CHitType.MISS;
                    case "rep_hit":
                        return CHitType.HIT;
                    case "rep_hit_good":
                        return CHitType.GOOD;
                    case "rep_hit_crit":
                        return CHitType.CRIT;
                    default:
                        return null;
                }
            }
        }
    });
    CHitType.MISS = 0;
    CHitType.HIT = 1;
    CHitType.GOOD = 2;
    CHitType.CRIT = 3;

    // heal type
    var CHealType = DefineClass({
        extend: CKey,
        construct: function(HealText) {
            this._sType;

            if (HealText != null) {
                this._sType = HealText;
            }
        },
        methods: {
            GetType: function() {
                return this._sType;
            },
            compareTo: function(that) {
                return CompareString(this._sType, that._sType);
            },
            toString: function() {
                return this._sType;
            }
        }
    });

    // Damage Type
    var CDamageType = DefineClass({
        extend: CKey,
        construct: function(DamageTypeText) {
            this._sType;

            if (DamageTypeText != null) {
                this._sType = DamageTypeText;
            }
        },
        methods: {
            GetType: function() {
                return this._sType;
            },
            compareTo: function(that) {
                return CompareString(this._sType, that._sType);
            },
            toString: function() {
                return this._sType;
            }
        }
    });

    var CDamage = DefineClass({
        extend: CKey,
        construct: function(HTMLElement) {
            this._nBasicDmg;
            this._nActualDmg;
            this._nArmor;
            this._sType;
            this._cType;

            if (HTMLElement != null) {
                var Str;
                if (HTMLElement.nodeType != 3) {
                    Str = HTMLElement.getAttribute("onmouseover");
                    // \1	basic damage
                    var Patt_BasicDamage = Local.Pattern_BasicDamage;
                    var result = Patt_BasicDamage.exec(Str);
                    if (result == null)
                        throw "CDamage() :" + Str;
                    this._nBasicDmg = Number(result[1]);
                    Str = HTMLElement.firstChild.data;
                } else
                    Str = HTMLElement.data;

                // \1	actual damage
                // \2	armor
                // \3	damage type
                var Patt_Damage = Local.Pattern_Damage;
                var result = Patt_Damage.exec(Str);
                if (result == null)
                    throw "CDamage() :" + Str;
                this._nActualDmg = Number(result[1]);
                this._nArmor = result[2] != null ? Number(result[2]) : 0;
                this._sType = result[3] || "";
                this._cType = new CDamageType(this._sType);

                if (this._nBasicDmg == null)
                    this._nBasicDmg = this._nActualDmg + this._nArmor;
            }
        },
        methods: {
            GetType: function() {
                return this._sType;
            },
            GetDamageType: function() {
                return this._cType;
            },
            GetBasicDmg: function() {
                return this._nBasicDmg;
            },
            GetArmor: function() {
                return this._nArmor;
            },
            GetActualDmg: function() {
                return this._nActualDmg;
            },
            IsHPDamage: function() {
                return Local.OrigTextList_NoneHPDamageType.indexOf(this._sType) <= -1;
            },
            compareTo: function(that) {
                return this._nBasicDmg - that._nBasicDmg;
            },
            toString: function() {
                if (this._sType != null) {
                    var Str = String(this._nBasicDmg);
                    if (this._nArmor > 0)
                        Str += " - " + this._nArmor + " -> " + this._nActualDmg;
                    else if (this._nBasicDmg !== this._nActualDmg)
                        Str += " -> " + this._nActualDmg;
                    Str += " " + this._sType;
                    return Str;
                } else
                    return "";
            }
        }
    });


    ///////////////////////////////////////////////////////////////////////////////
    // Class: Value list
    // Value list is a special key, it can contains any type of values, including keys

    var CValueList = DefineClass({
        extend: CKey,
        construct: function() {
            this._gValue = [];
            this._nAvgValue; // unsure type
            this._nMaxValue; // unsure type
            this._nMinValue; // unsure type
            this._nSTDValue; // unsure type
        },
        methods: {
            GetLength: function() {
                return this._gValue.length;
            },
            Calculate: function() {},
            push: function(Value) {
                return this._gValue.push(Value);
            },
            compareTo: function(that) {
                return this._nAvgValue - that._nAvgValue;
            },
            AvgValueStr: function() {
                return String(this._nAvgValue);
            },
            MaxValueStr: function() {
                return String(this._nMaxValue);
            },
            MinValueStr: function() {
                return String(this._nMinValue);
            },
            STDValueStr: function() {
                return String(this._nSTDValue);
            },
            toString: function() {
                return this._gValue.join(", ");
            }
        }
    });


    var CVLNumber = DefineClass({
        extend: CValueList,
        construct: function() {
            this.superclass();
        },
        methods: {
            Calculate: function() {
                var nTotalValue = 0;
                for (var i = 0; i < this._gValue.length; ++i)
                    nTotalValue += Number(this._gValue[i]);
                this._nAvgValue = Number((nTotalValue / this._gValue.length).toFixed(2));
                this._nMaxValue = getMax(this._gValue);
                this._nMinValue = getMin(this._gValue);
                this._nSTDValue = getSTD(this._gValue);
            }
        }
    });


    // value: [Number1, Number2]
    var CVLPairNumber = DefineClass({
        extend: CValueList,
        construct: function() {
            this.superclass();
        },
        methods: {
            Calculate: function() {
                var nTotalValue = [0, 0];

                var gValueZero = [];
                var gValueFirst = [];
                for (var i = 0; i < this._gValue.length; ++i) {
                    gValueZero.push(this._gValue[i][0]);
                    gValueFirst.push(this._gValue[i][1]);
                    nTotalValue[0] += this._gValue[i][0];
                    nTotalValue[1] += this._gValue[i][1];
                };

                this._nAvgValue = new Array(2);
                this._nAvgValue[0] = Number((nTotalValue[0] / this._gValue.length).toFixed(2));
                this._nAvgValue[1] = Number((nTotalValue[1] / this._gValue.length).toFixed(2));
                this._nMaxValue = new Array(2);
                this._nMaxValue[0] = getMax(gValueZero);
                this._nMaxValue[1] = getMax(gValueFirst);
                this._nMinValue = new Array(2);
                this._nMinValue[0] = getMin(gValueZero);
                this._nMinValue[1] = getMin(gValueFirst);
                this._nSTDValue = new Array(2);
                this._nSTDValue[0] = getSTD(gValueZero);
                this._nSTDValue[1] = getSTD(gValueFirst);
            },
            compareTo: function(that) {
                if (this._nAvgValue[0] !== 0 || that._nAvgValue[0] !== 0)
                    return this._nAvgValue[0] - that._nAvgValue[0];
                else
                    return this._nAvgValue[1] - that._nAvgValue[1];
            },
            AvgValueStr: function() {
                return CVLPairNumber._GetString(this._nAvgValue);
            },
            MaxValueStr: function() {
                return CVLPairNumber._GetString(this._nMaxValue);
            },
            MinValueStr: function() {
                return CVLPairNumber._GetString(this._nMinValue);
            },
            STDValueStr: function() {
                return CVLPairNumber._GetString(this._nSTDValue);
            },
            toString: function() {
                var Str = "";
                for (var i = 0; i < this._gValue.length; ++i) {
                    Str += (this._gValue[i][0] != null) ? this._gValue[i][0] : 0;
                    Str += "/";
                    Str += (this._gValue[i][1] != null) ? this._gValue[i][1] : 0;
                    if (i < this._gValue.length - 1)
                        Str += ", ";
                }
                return Str;
            }
        },
        statics: {
            _GetString: function(data) {
                var id = data[0] + "_" + data[1];
				return '<table class="pair_value" id="' + id + '"><tr><td>' +
                    ((data[0] !== 0) ? String(data[0]) : '') +
                    '</td><td>' +
                    ((data[1] !== 0) ? String(data[1]) : '') +
                    '</td></tr></table>';
            }
        }
    });


    // value: An Array of CDamage
    var CVLDamage = DefineClass({
        extend: CValueList,
        construct: function() {
            this.superclass();
        },
        methods: {
            Calculate: function() {
                var nTotalValue = [0, 0];
                var gValueBasic = [];
                var gValueActual = [];

                for (var i = 0; i < this._gValue.length; ++i) {
                    var nSumOneAtkValue = [0, 0];
                    for (var j = 0; j < this._gValue[i].length; ++j) {
                        //if (this._gValue[i][j].IsHPDamage()) {
                            nTotalValue[0] += this._gValue[i][j].GetBasicDmg();
                            nTotalValue[1] += this._gValue[i][j].GetActualDmg();
                            nSumOneAtkValue[0] = nSumOneAtkValue[0] + this._gValue[i][j].GetBasicDmg();
                            nSumOneAtkValue[1] = nSumOneAtkValue[1] + this._gValue[i][j].GetActualDmg();
                        //}
                    }
                    gValueBasic.push(nSumOneAtkValue[0]);
                    gValueActual.push(nSumOneAtkValue[1]);
                }
                this._nAvgValue = new Array(2);
                this._nAvgValue[0] = Number((nTotalValue[0] / this._gValue.length).toFixed(2));
                this._nAvgValue[1] = Number((nTotalValue[1] / this._gValue.length).toFixed(2));
                this._nMaxValue = new Array(2);
                this._nMaxValue[0] = getMax(gValueBasic);
                this._nMaxValue[1] = getMax(gValueActual);
                this._nMinValue = new Array(2);
                this._nMinValue[0] = getMin(gValueBasic);
                this._nMinValue[1] = getMin(gValueActual);
                this._nSTDValue = new Array(2);
                this._nSTDValue[0] = getSTD(gValueBasic);
                this._nSTDValue[1] = getSTD(gValueActual);
            },
            compareTo: function(that) {
                return this._nAvgValue[1] - that._nAvgValue[1];
            },
            AvgValueStr: function() {
                return CVLDamage._GetString(this._nAvgValue);
            },
            MaxValueStr: function() {
                return CVLDamage._GetString(this._nMaxValue);
            },
            MinValueStr: function() {
                return CVLDamage._GetString(this._nMinValue);
            },
            STDValueStr: function() {
                return CVLDamage._GetString(this._nSTDValue);
            },
            toString: function() {
                var Str = "";
                for (var i = 0; i < this._gValue.length; ++i) {
                    var nTotalValue = [0, 0];
                    for (var j = 0; j < this._gValue[i].length; ++j) {
                        //if (this._gValue[i][j].IsHPDamage()) {
                            nTotalValue[0] += this._gValue[i][j].GetBasicDmg();
                            nTotalValue[1] += this._gValue[i][j].GetActualDmg();
                        //}
                    }
                    Str += nTotalValue[1] + "/" + nTotalValue[0];
                    if (i < this._gValue.length - 1)
                        Str += ", ";
                }
                return Str;
            }
        },
        statics: {
            _GetString: function(data) {
				var id = data[1] + "_" + data[0];
				return '<table class="pair_value" id="' + id + '"><tr><td>' +
                    data[1] + '</td><td>' +
                    data[0] + '</td></tr></table>';
            }
        }
    });


    ///////////////////////////////////////////////////////////////////////////////
    // Class: Info list
	function CCellContent(value,rowspan,show,filterId)
	{
		this.value = value;
		this.rowspan = rowspan;
		this.show = show;
		this.filterId = filterId;
	}
	
    function CKeyType(name, type) {
        this.Name = name;
        this.Type = type;
        this.getValue = function(info) {
            switch (this.Name) {
                case Local.Text_Table_AvgRoll:
                case Local.Text_Table_ItemDamagePoints:
                    return info.ValueList.AvgValueStr();
                case Local.Text_Table_Times:
                    return info.ValueList.GetLength();
                case Local.Text_Table_MaxRoll:
                    return info.ValueList.MaxValueStr();
                case Local.Text_Table_MinRoll:
                    return info.ValueList.MinValueStr();
                case Local.Text_Table_STDRoll:
                    return info.ValueList.STDValueStr();
                case Local.Text_Table_RollList:
                    return CreateElementHTML("input", null, ["type", "button"], ["class", "button"], ["value", Local.Text_Button_Show], ["onclick", 'alert(&quot;' + info.ValueList.toString() + '&quot;);']);
                default:
                    return this.Name;
            }
        }
    }

    CKeyType.AvgRoll = function() {
        return new CKeyType(Local.Text_Table_AvgRoll, "number");
    }

    CKeyType.Times = function() {
        return new CKeyType(Local.Text_Table_Times, "number");
    }

    CKeyType.MaxRoll = function() {
        return new CKeyType(Local.Text_Table_MaxRoll, "number");
    }

    CKeyType.MinRoll = function() {
        return new CKeyType(Local.Text_Table_MinRoll, "number");
    }

    CKeyType.STDRoll = function() {
        return new CKeyType(Local.Text_Table_STDRoll, "number");
    }

    CKeyType.RollList = function() {
        return new CKeyType(Local.Text_Table_RollList, "button");
    }

    CKeyType.Char = function() {
        return new CKeyType(Local.Text_Table_Char, "string");
    }

    CKeyType.AttackType = function() {
        return new CKeyType(Local.Text_Table_AttackType, "string");
    }

    CKeyType.Skill = function() {
        return new CKeyType(Local.Text_Table_Skill, "string");
    }

    CKeyType.Item = function() {
        return new CKeyType(Local.Text_Table_Item, "string");
    }

    CKeyType.Position = function() {
        return new CKeyType(Local.Text_Table_Position, "string");
    }

    CKeyType.HealType = function() {
        return new CKeyType(Local.Text_Table_HealType, "string");
    }
	
    CKeyType.DamageType = function() {
        return new CKeyType(Local.Text_Table_DamageType, "string");
    }

    CKeyType.DefenceType = function() {
        return new CKeyType(Local.Text_Table_DefenceType, "string");
    }

    CKeyType.ItemDamagePoints = function() {
        return new CKeyType(Local.Text_Table_ItemDamagePoints, "string");
    }

    CKeyType.ValueName = function() {
        return [CKeyType.AvgRoll(), CKeyType.Times(), CKeyType.MaxRoll(), CKeyType.MinRoll(), CKeyType.STDRoll(), CKeyType.RollList()];
    }

    var CInfoList = DefineClass({
        construct: function(CValueList, Title, Id, gKeyName, gValueName) {
            this._gInfo = [];
            this._gKeyName = gKeyName || [];
            this._nKeys = this._gKeyName.length;
            this._CValueList = CValueList || [];
            this._Table = null;
            this._Title = Title || "";
            this._Id = Id || "";
            this._gValueName = gValueName || [];
            this._Allkey = this._gKeyName.concat(this._gValueName);
        },
        methods: {
            _CompareKeys: function(gKeyA, gKeyB) {
                for (var i = 0; i < this._nKeys; ++i) {
                    var result = gKeyA[i].compareTo(gKeyB[i]);
                    if (result !== 0)
                        return result;
                }
                return 0;
            },
            _SetTableBodyCellContents: function() {
                if(this._gInfo.length <=0)
					return;
				var tablecontent = [];
				var keys = this._gInfo[0].gKey.length;
				var filters = new Array(keys);
				for(var i = 0; i< keys; i++)
				{
					var filter = [];
					filters[i]=filter;
				}
				for (var i = 0; i < this._gInfo.length; ++i) {
                    var gBodyCellContent = [];
					for (var j = 0; j < this._gInfo[i].gKey.length; ++j)
					{
						var value = this._gInfo[i].gKey[j];
						var filter = value.toText();
						if(filters[j].indexOf(filter) <= -1)
							filters[j].push(filter);
						gBodyCellContent.push(new CCellContent(value,1,true,filters[j].indexOf(filter)));
					}
                    for (var j = 0; j < this._gValueName.length; ++j)
                        gBodyCellContent.push(new CCellContent(this._gValueName[j].getValue(this._gInfo[i]),1,true,-1));

                    tablecontent.push(gBodyCellContent);					
                }
				
				this._Table.SetHeadCellContentFilters.apply(this._Table, filters);
				
				if(groupData)
				{
					for( var i = tablecontent.length -1; i > 0; i--)
					{
						for(var j=0;j<keys;j++)
						{
							if(tablecontent[i][j].value.compareTo(tablecontent[i-1][j].value) === 0)
							{
								tablecontent[i][j].show = false;
								tablecontent[i-1][j].rowspan = tablecontent[i][j].rowspan + 1;
							}
							else
								break;
						}
					}
				}
				for( var i = 0; i< tablecontent.length ;i++)
                    this._Table.SetBodyCellContents.apply(this._Table, tablecontent[i]);
            },
            SaveInfo: function(Info) {},
            Output: function(isExport) {
                if (this._gInfo.length > 0) {
                    this.CalculateValue();
                    this.sort();
                    return this.CreateTable(isExport);
                }
                return "";
            },
            Show: function() {
                return this.Output(false);
            },
            Export: function() {
                return this.Output(true);
            },
            // Call this function when read all data, and before sort and export data
            CalculateValue: function() {
                for (var i = 0; i < this._gInfo.length; ++i)
                    this._gInfo[i].ValueList.Calculate();
            },
            CreateTable: function(isExport) {
                // Key1, Key2, ..., AverageValue, Times, MaxValue, MinValue, STDValue, ValueList
                this._Table = new CTable(this._Title, this._Id, this._Allkey.length, isExport);

                var gHeadCellContent = new Array(this._Allkey.length);
                var gBodyCellContentType = new Array(this._Allkey.length);
                for (var i = 0; i < this._Allkey.length; ++i) {
                    gHeadCellContent[i] = this._Allkey[i].Name;
                    gBodyCellContentType[i] = this._Allkey[i].type;
                }

                this._Table.SetHeadCellContents.apply(this._Table, gHeadCellContent);
                this._Table.SetBodyCellContentTypes.apply(this._Table, gBodyCellContentType);

                this._SetTableBodyCellContents();

                return this._Table.CreateHTML();
            },
            // Call this function when edited the info list (for example, re-sorted it)
            ReCreateTableHTML: function() {
                this._SetTableBodyCellContents();
                return this._Table.CreateHTML();
            },
            GetTableHTML: function() {
                return this._Table.GetHTML();
            },
            AddEvents: function() {
                if (this._Table != null) this._Table.AddEvents();
            },
            push: function(gKey, Value) {
                for (var i = 0; i < this._gInfo.length; ++i) {
                    if (this._CompareKeys(this._gInfo[i].gKey, gKey) === 0) {
                        this._gInfo[i].ValueList.push(Value);
                        return this._gInfo.length;
                    }
                }

                var ValueList = new this._CValueList();
                ValueList.push(Value);
                return this._gInfo.push(new CInfoList._CInfo(gKey, ValueList));
            },
            sort: function(gSortKeyId) {
                function Factory(gId) {
                    return function(A, B) {
                        return CInfoList._CompareInfo(A, B, gId);
                    };
                }
                return this._gInfo.sort(Factory(gSortKeyId));
            }
        },
        statics: {
            _CInfo: function(gKey, ValueList) {
                this.gKey = gKey;
                this.ValueList = ValueList;
            },
            // SortKeyId: Id of keys, or null
            // The list will be sorted in this way: sort them by the first key, if there are
            //   elements are still equal, then sort them by the second key, and so on.
            // If SortKeyId is null, then sort the list by value
            // If gSortKeyId is null, then sort the list by default order of keys
            _CompareInfo: function(InfoA, InfoB, gSortKeyId) {
                if (gSortKeyId == null) {
                    for (var i = 0; i < InfoA.gKey.length; ++i) {
                        var result = InfoA.gKey[i].compareTo(InfoB.gKey[i]);
                        if (result !== 0) return result;
                    }
                    return 0;
                } else {
                    for (var i = 0; i < gSortKeyId.length; ++i) {
                        var KeyId = gSortKeyId[i];
                        var result = (KeyId != null) ?
                            InfoA.gKey[KeyId].compareTo(InfoB.gKey[KeyId]) :
                            InfoA.ValueList.compareTo(InfoB.ValueList);
                        if (result !== 0) return result;
                    }
                    return 0;
                }
            }
        }
    });


    ///////////////////////////////////////////////////////////////////////////////
    // Sub classes of CInfoList
    //
    // var CIL_ = DefineClass({
    //	extend: CInfoList,
    //	construct: function(_nKeys, CValueList) {this.superclass(_nKeys, CValueList);},
    //	methods:
    //		{
    //		_SetTableBodyCellContents: function() {},
    //		SaveInfo: function(Info) {},
    //		Show: function() {},
    //		CreateTable: function(Title, Id, gKeyName) {}
    //		}
    //	});

    var CILIni = DefineClass({
        extend: CInfoList,
        construct: function(CValueList) {
            this.superclass(CValueList, Local.Text_Table_Ini, "stat_ini", [CKeyType.Char()],
                CKeyType.ValueName());
        },
        methods: {
            SaveInfo: function(Info) {
                if (Info.Active.nCurrAction === 1)
                    this.push([Info.Active.Char], Info.Active.nIniRoll);
            }
        }
    });


    var CILAttackRoll = DefineClass({
        extend: CInfoList,
        construct: function(CValueList) {
            this.superclass(CValueList, Local.Text_Table_Attack, "stat_attack", [CKeyType.Char(), CKeyType.AttackType(), CKeyType.Skill(), CKeyType.Item(), CKeyType.Position()],
                CKeyType.ValueName());
        },
        methods: {
            SaveInfo: function(Info) {
                if (Info.Active.ActionType.GetKind() === CActionType.ATTACK && Info.Active.gAttackRoll.length != 0) {
                    for (var i = 0; i < Info.Active.gAttackRoll.length; ++i) {
                        this.push([Info.Active.Char, Info.Active.ActionType, Info.Active.Skill, Info.Active.gItem, Info.Active.gPosition._gKey[i]],
                            Info.Active.gAttackRoll[i]);
                    }
                }
            }
        }
    });


    var CILDefenceRoll = DefineClass({
        extend: CInfoList,
        construct: function(CValueList) {
            this.superclass(CValueList, Local.Text_Table_Defence, "stat_defence", [CKeyType.Char(), CKeyType.DefenceType(), CKeyType.Skill(), CKeyType.Item()],
                CKeyType.ValueName());
        },
        methods: {
            SaveInfo: function(Info) {
                if (Info.Active.ActionType.GetKind() === CActionType.ATTACK) {
                    for (var i = 0; i < Info.gPassive.length; ++i) {
                        if (Info.gPassive[i].nDefenceRoll != null)
                            this.push([Info.gPassive[i].Char, Info.Active.ActionType,
       Info.gPassive[i].Skill, Info.gPassive[i].gItem], Info.gPassive[i].nDefenceRoll);
                    }
                }
            }
        }
    });


    var CILDamage = DefineClass({
        extend: CInfoList,
        construct: function(CValueList) {
            this.superclass(CValueList, Local.Text_Table_Damage, "stat_damage", [CKeyType.Char(), CKeyType.AttackType(), CKeyType.Skill(), CKeyType.Item(), CKeyType.DamageType()],
                CKeyType.ValueName());
        },
        methods: {
            SaveInfo: function(Info) {
                if (Info.Active.ActionType.GetKind() === CActionType.ATTACK) {
                    for (var i = 0; i < Info.gPassive.length; ++i) {
                        if (Info.gPassive[i].gDamage.length > 0) {
                            //var damage = [];
                            //damage.push(Info.gPassive[i].gDamage);
                            for (var index = 0; index < Info.gPassive[i].gDamage.length; index++) {
                                this.push([Info.Active.Char, Info.Active.ActionType, Info.Active.Skill, Info.Active.gItem, Info.gPassive[i].gDamage[index].GetDamageType()], [Info.gPassive[i].gDamage[index]]);
                            }
                        }

                    }
                }
            }
        }
    });


    var CILHeal = DefineClass({
        extend: CInfoList,
        construct: function(CValueList) {
            this.superclass(CValueList, Local.Text_Table_Heal, "stat_heal", [CKeyType.Char(), CKeyType.Skill(), CKeyType.Item(), CKeyType.HealType()],
                CKeyType.ValueName());
        },
        methods: {
            SaveInfo: function(Info) {
                if (Info.Active.ActionType.GetKind() === CActionType.HEAL) {
                    for (var i = 0; i < Info.gPassive.length; ++i) {
                        if (Info.gPassive[i].nHealedHP != null)
							this.push([Info.Active.Char, Info.Active.Skill, Info.Active.gItem, new CHealType('HP')], [Number(Info.gPassive[i].nHealedHP)]);

						if (Info.gPassive[i].nHealedMP != null)
                            this.push([Info.Active.Char, Info.Active.Skill, Info.Active.gItem, new CHealType('MP')], [Number(Info.gPassive[i].nHealedMP)]);
                    }
                }
            }
        }
    });


    var CILHealed = DefineClass({
        extend: CInfoList,
        construct: function(CValueList) {
            this.superclass(CValueList, Local.Text_Table_Healed, "stat_healed", [CKeyType.Char(), CKeyType.HealType()],
                CKeyType.ValueName());
        },
        methods: {
            SaveInfo: function(Info) {
                if (Info.Active.ActionType.GetKind() === CActionType.HEAL) {
                    for (var i = 0; i < Info.gPassive.length; ++i) {
                        if (Info.gPassive[i].nHealedHP != null)
                            this.push([Info.gPassive[i].Char,new CHealType('HP')], [Number(Info.gPassive[i].nHealedHP)]);

						if(Info.gPassive[i].nHealedMP != null)
                            this.push([Info.gPassive[i].Char,new CHealType('MP')], [Number(Info.gPassive[i].nHealedMP)]);
                    }
                }
            }
        }
    });


    var CILItemDamage = DefineClass({
        extend: CInfoList,
        construct: function(CValueList) {
            this.superclass(CValueList, Local.Text_Table_DamagedItems, "stat_item_damage", [CKeyType.Char(), CKeyType.Item()], [CKeyType.Times(), CKeyType.ItemDamagePoints(), CKeyType.RollList()]);
        },
        methods: {
            SaveInfo: function(Info) {
                if (Info.Active.ActionType.GetKind() === CActionType.ATTACK) {
                    for (var i = 0; i < Info.gPassive.length; ++i) {
                        if (Info.gPassive[i].nItemDamage != null)
                            this.push([Info.gPassive[i].Char, Info.gPassive[i].DamagedItem],
                                Info.gPassive[i].nItemDamage);
                    }
                }
            }
        }
    });


    // FUNCTIONS //////////////////////////////////////////////////////////////////
    function getActions(page) {
        var allTable = page.getElementsByTagName("table");
        for (var i = 0; i < allTable.length; i++) {

        }

    }

    function CountStat(page, bLastSubPage, alsoSaveEntire) {
        // Read the last round only when reading the last sub page
        if (!bLastSubPage) RemoveLastRound(page);

        var Navi = new CNavi(0, 0, 0, 0);


        var allRows = page.getElementsByTagName("tr");
        for (var i = 0; i < allRows.length; ++i) {
            var Info = new CActionInfo(Navi);


            var IniColumn = first_child(allRows[i]);
            if (!GetIniInfo(IniColumn, Info))
                continue;
            ++Info.Navi.nRow;

            var ActiveColumn = node_after(IniColumn);
            GetActiveInfo(ActiveColumn, Info);

            switch (Info.Active.ActionType.GetKind()) {
                case CActionType.ATTACK: // Attack
                    {
                        var PassiveColumn = node_after(ActiveColumn);
                        GetAttackedInfo(PassiveColumn, Info);
                        break;
                    }
                case CActionType.HEAL: // Heal
                case CActionType.BUFF: // Buff
                    {
                        var PassiveColumn = node_after(ActiveColumn);
                        GetHealedBuffedInfo(PassiveColumn, Info);
                        break;
                    }
                case CActionType.WAIT: // Wait
                default: // Unknown
                    ;
            }
            Stat.SaveInfo(Info);
            if (alsoSaveEntire)
                StatEntire.SaveInfo(Info);
        };
    }


    function RemoveLastRound(page) {
        var allRows = page.getElementsByTagName("tr");
        for (var i = 0; i < allRows.length; ++i) {
            if (allRows[i].className != null &&
                rValue.Pattern_logRow.test(allRows[i].className)) {
                var allH1 = allRows[i].getElementsByTagName("h1");
                if (allH1[0] != null &&
                    allH1[0].firstChild != null &&
                    allH1[0].firstChild.nodeType == Node.TEXT_NODE &&
                    allH1[0].firstChild.data == Local.OrigText_LastRound) {
                    allRows[i].parentNode.removeChild(allRows[i]);
                    break;
                }
            }
        };
    }


    function GetIniInfo(Node, Info) {
        if (Node == null || Node.className != "rep_initiative")
            return false;

        if (Node.innerHTML == "&nbsp;")
            return false;

        // \1	ini
        // \2	current action
        // \3	total actions
        var Patt_Ini = Local.Pattern_Ini;
        var result = Patt_Ini.exec(Node.innerHTML);
        if (result == null) {
            DbgMsgAction(Info, "IniInfo: " + Node.innerHTML);
            return false;
        }

        var active = Info.Active;
        active.nIniRoll = Number(result[1]);
        active.nCurrAction = Number(result[2]);
        active.nTotalActions = Number(result[3]);
        return active.nIniRoll != null;
    }


    // return: whether the format is right
    function GetActiveInfo(Node, Info) {
        if (Node == null) {
            DbgMsgAction(Info, "ActiveInfo: null");
            return false;
        }
        var nStartNode = 0;
        var Str = Node.innerHTML;
        var active = Info.Active;

        // \1	span node
        // \2	npc Id
        var Patt_Char = Local.Pattern_Active_Char;
        var result = Patt_Char.exec(Str);
        if (result == null) {
            DbgMsgAction(Info, "ActiveInfo (Char): " + Node.innerHTML);
            return true;
        }
        var CharNode = result[1] != null ? Node.childNodes[nStartNode].childNodes[0] :
            Node.childNodes[nStartNode];
        active.Char = new CChar(CharNode);
        active.nCharId = result[2] != null ? Number(result[2]) : null;
        nStartNode += result[1] != null ? 1 : (result[2] != null ? 2 : 1);
        Str = Str.substring(result[0].length);

        // \1	attack
        // \2	heal or buff
        // \3	left parenthesis
        var Patt_Action1 = Local.Pattern_Active_Action1;
        result = Patt_Action1.exec(Str);
        if (result == null) {
            // \1	other action
            var Patt_Action2 = Local.Pattern_Active_Action2;
            result = Patt_Action2.exec(Str);
            if (result == null) {
                DbgMsgAction(Info, "ActiveInfo (Action2): " + Node.innerHTML);
                return false;
            }
            active.ActionType = new CActionType(result[1]);
            return true;
        }
        if (result[1] != null) {
            active.ActionType = new CActionType(result[1]);
            if (active.ActionType.GetKind() !== CActionType.ATTACK) {
                DbgMsgAction(Info, "ActiveInfo (Attack Type): " + result[1]);
                return false;
            }
            nStartNode += 1;
            Str = Str.substring(result[0].length);
        } else {
            active.ActionType = new CActionType(result[2]);
            if (active.ActionType.GetKind() !== CActionType.HEAL && active.ActionType.GetKind() !== CActionType.BUFF) {
                DbgMsgAction(Info, "ActiveInfo (Heal/Buff Type): " + result[2]);
                return false;
            }
            active.Skill = new CSkill(Node.childNodes[nStartNode + 1]);
            if (result[3] == null)
                return true;
            nStartNode += 3;
            Str = Str.substring(result[0].length);
        }

        switch (active.ActionType.GetKind()) {
            case CActionType.ATTACK: // attack
                {
                    // \1	single roll
                    // \2   multiple positions and rolls
                    // \3	position n (only the last one)
                    // \4	multiple roll n (only the last one)
                    // \5	MP
                    // \6	item list
                    // \7   HP
                    var Patt_ActtackDetails = Local.Pattern_Active_AttackDetails;
                    result = Patt_ActtackDetails.exec(Str);
                    if (result == null) {
                        DbgMsgAction(Info, "ActiveInfo (ActtackDetails): " + Node.innerHTML);
                        return false;
                    }
                    active.Skill = new CSkill(Node.childNodes[nStartNode]);
                    active.gAttackRoll = [];
                    active.gPosition = new CKeyList();
                    if (result[1] != null) {
                        active.gAttackRoll.push(Number(result[1]));
                        active.gPosition.push(new CPositionType(''));
                    };
                    if (result[2] != null) {
                        var pattern_pos_atk = /^([^\u0000-\u007F]+): ([\d]+)$/
                        var gPos_Atk = result[2].split('/');
                        for (var i = 1; i < gPos_Atk.length; ++i) {
                            var inner_result = pattern_pos_atk.exec(gPos_Atk[i]);
                            active.gAttackRoll.push(Number(inner_result[2]));
                            active.gPosition.push(new CPositionType(inner_result[1]));
                        }
                    }
                    active.nSkillMP = result[5] != null ? Number(result[5]) : null;
                    active.nSkillHP = result[7] != null ? Number(result[7]) : null;
                    if (result[6] != null) {
                        active.gItem = new CKeyList();
                        nStartNode += result[5] != null ? 4 : 2;
                        var ItemNode;
                        while ((ItemNode = Node.childNodes[nStartNode]) != null) {
                            var temp_item = new CItem(ItemNode);
                            if (temp_item._Name != null) {
                                active.gItem.push(temp_item);
                            };
                            nStartNode += 2;
                        }
                    }
                    return true;
                }
            case CActionType.HEAL: // heal
            case CActionType.BUFF: // buff
                {
                    // \1	MP
                    // \2	normal item list
                    // \3	magical potion
                    var Patt_HealBuffDetails = Local.Pattern_Active_HealBuffDetails;
                    result = Patt_HealBuffDetails.exec(Str);
                    if (result == null) {
                        DbgMsgAction(Info, "ActiveInfo (HealBuffDetails): " + Node.innerHTML);
                        return false;
                    }
                    active.nSkillMP = result[1] != null ? Number(result[1]) : null;
                    if (result[2] != null) {
                        active.gItem = new CKeyList();
                        nStartNode += result[1] != null ? 2 : 0;
                        var ItemNode;
                        while ((ItemNode = Node.childNodes[nStartNode]) != null) {
                            active.gItem.push(new CItem(ItemNode));
                            nStartNode += 2;
                        }
                    } else if (result[3] != null) {
                        active.gItem = new CKeyList();
                        nStartNode += result[1] != null ? 2 : 0;
                        active.gItem.push(new CItem(Node.childNodes[nStartNode]));
                        // nStartNode: determine by the number of reagents
                    }
                    return true;
                }
            default: // impossible, the value can only be 0, 1, or 2
                return false;
        }
    }


    // return: whether the format is right
    function GetAttackedInfo(Node, Info) {
        if (Node == null) {
            DbgMsgAction(Info, "AttackedInfo: null");
            return false;
        }
        var nStartNode = 0;
        var Str = Node.innerHTML;

        // \1	char span node
        // \2	char Id
        // \3	skill
        // \4	defence roll
        // \5	MP
        // \6	item list
        // \7	hit type
        // \8	struck down
        // \9	damage list
        // \10	item damage
        // \11	next flag
        var Patt_Attacked = Local.Pattern_Passive_Attacked;
        var bEnd = false;
        while (!bEnd) {
            var PassiveInfo = new CPassiveInfo();
            var result = Patt_Attacked.exec(Str);
            if (result == null) {
                DbgMsgAction(Info, "AttackedInfo: " + Node.innerHTML);
                return true;
            }
            var CharNode = result[1] != null ? Node.childNodes[nStartNode].childNodes[0] :
                Node.childNodes[nStartNode];
            PassiveInfo.Char = new CChar(CharNode);
            PassiveInfo.nCharId = result[2] != null ? Number(result[2]) : null;
            nStartNode += result[1] != null ? 1 : (result[2] != null ? 2 : 1);
            if (result[3] != null) {
                PassiveInfo.Skill = new CSkill(Node.childNodes[nStartNode + 1]);
                nStartNode += 2;
            }
            PassiveInfo.nDefenceRoll = Number(result[4]);
            if (result[5] != null) {
                PassiveInfo.nSkillMP = Number(result[5]);
                nStartNode += 2;
            }
            if (result[6] != null) {
                PassiveInfo.gItem = new CKeyList();
                nStartNode += 1;
                var ItemNode = Node.childNodes[nStartNode];
                while (ItemNode != null && ItemNode.nodeName == "A") {
                    PassiveInfo.gItem.push(new CItem(ItemNode));
                    nStartNode += 2;
                    ItemNode = Node.childNodes[nStartNode];
                }
            } else
                nStartNode += 1;
            PassiveInfo.HitType = new CHitType(result[7]);
            PassiveInfo.bStruckDown = (result[8] != null);
            nStartNode += result[8] != null ? 2 : 1;
            if (result[9] != null) {
                PassiveInfo.gDamage = [];
                nStartNode += 1;
                var DamageNode = Node.childNodes[nStartNode];
                while (DamageNode != null && (DamageNode.nodeType == Node.TEXT_NODE ||
                    (DamageNode.nodeName == "SPAN" &&
                        DamageNode.firstChild != null && DamageNode.firstChild.nodeType == Node.TEXT_NODE))) {
                    PassiveInfo.gDamage.push(new CDamage(DamageNode));
                    nStartNode += 2;
                    DamageNode = Node.childNodes[nStartNode];
                }
                nStartNode -= 1;
            }
            if (result[10] != null) {
                PassiveInfo.DamagedItem = new CItem(Node.childNodes[nStartNode + 1]);
                PassiveInfo.nItemDamage = Number(result[10]);
                nStartNode += 3;
            }
            if (result[11] != null)
                nStartNode += 1;
            else
                bEnd = true;

            Info.gPassive.push(PassiveInfo);
            Str = Str.substring(result[0].length);
        }
        return true;
    }


    // return: whether the format is right
    function GetHealedBuffedInfo(Node, Info) {
        if (Node == null) {
            DbgMsgAction(Info, "HealedBuffedInfo: null");
            return false;
        }
        var nStartNode = 0;
        var Str = Node.innerHTML;

        // \1	span node
        // \2	char Id
        // \3	self
        // \4	HP
        // \5	MP
        // \6	next flag
        var Patt_HealedBuffed = Local.Pattern_Passive_Healed_Buffed;
        var bEnd = false;
        while (!bEnd) {
            var PassiveInfo = new CPassiveInfo();
            var result = Patt_HealedBuffed.exec(Str);
            if (result == null) {
                DbgMsgAction(Info, "HealedBuffedInfo: " + Node.innerHTML);
                return true;
            }
            if (result[3] != null) {
                PassiveInfo.Char = Info.Active.Char;
                PassiveInfo.nCharId = Info.Active.nCharId;
            } else {
                var CharNode = result[1] != null ? Node.childNodes[nStartNode].childNodes[0] :
                    Node.childNodes[nStartNode];
                PassiveInfo.Char = new CChar(CharNode);
                PassiveInfo.nCharId = result[2] != null ? Number(result[2]) : null;
                nStartNode += result[1] != null ? 1 : (result[2] != null ? 2 : 1);
            }
            PassiveInfo.nHealedHP = result[4] != null ? Number(result[4]) : null;
            PassiveInfo.nHealedMP = result[5] != null ? Number(result[5]) : null;
            nStartNode += 1;
            if (result[6] != null)
                nStartNode += 1;
            else
                bEnd = true;

            Info.gPassive.push(PassiveInfo);
            Str = Str.substring(result[0].length);
        }
        return true;
    }


    function DbgMsgAction(Info, Text) {
        if (DEBUG)
            alert("[" + Info.Navi.nLevel + "." + Info.Navi.nRoom + "." +
                Info.Navi.nRound + "." + Info.Navi.nRow + "] " + Text);
    }


    // GLOBAL VARIABLES ///////////////////////////////////////////////////////////

    var DEBUG = false;
	
	var groupData = false;
	
	var useFilter = true;

    var Contents = {
        OrigText_Button_DungeonDetails: ["details",
        "详细资料"],
        OrigText_Button_DuelDetails: ["Details",
        "详细"],
        OrigText_Button_DungeonStat: ["statistics",
        "统计表"],
        OrigText_Level: ["Level",
        "层数"],
        OrigText_LastRound: ["Last round:",
        "最后回合:"],
        OrigTextList_AttackActionType: [["attacks", "ranged attacks", "attacks with magic", "socially attacks", "cunningly attacks", "activates on", "works as a force of nature upon", "infected", "casts an explosion at", "deactivated", "magic projectile", "curse", "scare"],
        ["近战攻击", "远程攻击", "魔法攻击", "心理攻击", "偷袭", "触发", "作为自然灾害", "散布", "制造爆炸", "解除", "魔法投射", "诅咒", "恐吓", "冲击"]],
        OrigTextList_HealActionType: [["heals with"],
        ["治疗"]],
        OrigTextList_BuffActionType: [["uses", "summons with"],
        ["使用", "召唤"]],
        OrigTextList_WaitActionType: [["is unable to do anything.", "looks around in boredom and waits."],
        ["不能执行任何动作.", "无聊的打量四周，等待着."]],
        OrigTextList_NoneHPDamageType: [["mana damage","mana"],
        ["法力伤害","法力"]],
        Pattern_Ini: [/^Initiative ([\d]+)<br><span .*?>Action ([\d]+) of ([\d]+)<\/span>$/,
        /^先攻([\d]+)<br><span .*?>第([\d]+)步行动 \/ 共([\d]+)步<\/span>$/],
        Pattern_Active_Char: [/^(<span .*?>)?<a .*?>.*?<\/a>(?:<span .*?>([\d]+)<\/span>)?(?:<img .*?><\/span>)?/,
        /^(<span .*?>)?<a .*?>.*?<\/a>(?:<span .*?>([\d]+)<\/span>)?(?:<img .*?><\/span>)?/],
        Pattern_Active_Action1: [/^\s*(?:([A-Za-z][A-Za-z ]+[A-Za-z]) +\(|([A-Za-z][A-Za-z ]+[A-Za-z]) +<a .*?>.*?<\/a>(?:( \()|$| on $))/,
        /^\s*(?:([^\u0000-\u007F]+) +\(|([^\u0000-\u007F]+)<a .*?>.*?<\/a>(?:( \()|$|给$))/],
        Pattern_Active_Action2: [/^\s*([\S].*[\S])\s*$/,
        /^\s*([\S].*[\S])\s*$/],
        Pattern_Active_AttackDetails: [/^<a .*?>.*?<\/a>(?:\/([\d]+)|(?:\/([A-Za-z ]+): ([\d]+))+)(?:\/<span .*?>([\d]+) MP<\/span>)?(\/(?:<a .*?>.*?<\/a>,)*<a .*?>.*?<\/a>)?\)$/,
        /^<a .*?>.*?<\/a>(?:\/([\d]+)|((?:\/([^\u0000-\u007F]+): ([\d]+))+))(?:\/<span .*?>([\d]+) (?:法力|神力|怒气)<\/span>)?(\/(?:<a .*?>.*?<\/a>,)*<a .*?>.*?<\/a>)?(?:\/<span .*?>(?:<b>)?(?:-|\+)([\d]+) HP(?:<\/b>)?<\/span>)?(?:\/<span .*?>(?:<b>)?(?:-|\+)([\d]+) 法力(?:<\/b>)?<\/span>)?\)$/],
        Pattern_Active_HealBuffDetails: [/^(?:<span .*?>([\d]+) MP<\/span>)?(?:\/)?(?:((<a .*?>.*?<\/a>,)*<a .*?>.*?<\/a>)|(<a .*?>.*?<\/a>\s+(?:<img .*?>)+))?\)(?: on )?$/,
        /^(?:<span .*?>(?:-|\+)?([\d]+) (?:法力|神力|怒气)<\/span>)?(?:\/)?(?:((<a .*?>.*?<\/a>,)*<a .*?>.*?<\/a>)|(<a .*?>.*?<\/a>\s+(?:<img .*?>)+))?\)(?:给)?$/],
        Pattern_Passive_Attacked: [/^(<span .*?>)?<a .*?>.*?<\/a>(?:<span .*?>([\d]+)<\/span>)?(?:<img .*?><\/span>)?\s*\((<a .*?>.*?<\/a>\/)?([\d]+)(?:\/<span .*?>([\d]+) MP<\/span>)?(\/(?:<a .*?>.*?<\/a>,)*<a .*?>.*?<\/a>)?\): <span class="([A-Za-z_]+)">[A-Za-z ]+<\/span>( - [A-Za-z ]+)?(<br>(?:<span .*?>)?(?:-)?[\d]+ (?:\[(?:\+|-)[\d]+\] )?[A-Za-z ]+(?:<img .*?><\/span>)?)*(?:<br><a .*?>.*?<\/a> -([\d]+) HP)?(?:(<br>)|$)/,
        /^(<span .*?>)?<a .*?>.*?<\/a>(?:<span .*?>([\d]+)<\/span>)?(?:<img .*?><\/span>)?\s*\((<a .*?>.*?<\/a>\/)?([\d]+)(?:\/<span .*?>([\d]+) (?:法力|神力|怒气)<\/span>)?(\/(?:<a .*?>.*?<\/a>,)*<a .*?>.*?<\/a>)?\): <span class="([A-Za-z_]+)">[^\u0000-\u007F]+<\/span>( - [^\u0000-\u007F]+ *)?(<br>(?:<span .*?>)?(?:-)?[\d]+ (?:\[(?:\+|-)[\d]+\] )?[^\u0000-\u007F]+(?:<img .*?><\/span>)?)*(?:<br><a .*?>.*?<\/a> (?:-|\+)([\d]+) HP)?(?:(<br>)|$)/],
        Pattern_BasicDamage: [/causes: <b>([\d]+)<\/b>/,
        /造成: <b>([\d]+)<\/b>/],
        Pattern_Damage: [/^((?:-)?[\d]+) (?:\[((?:\+|-)[\d]+)\] )?([A-Za-z][A-Za-z ]+[A-Za-z])$/,
        /^((?:-)?[\d]+) (?:\[((?:\+|-)[\d]+)\] )?([^\u0000-\u007F]+)$/],
        Pattern_Passive_Healed_Buffed: [/^(?:(<span .*?>)?<a .*?>.*?<\/a>(?:<span .*?>([\d]+)<\/span>)?(?:<img .*?><\/span>)?\s+|(themselves))(?: \+([\d]+) HP)?(?: \+([\d]+) MP)?(?:(<br>)|$)/,
        /^(?:(<span .*?>)?<a .*?>.*?<\/a>(?:<span .*?>([\d]+)<\/span>)?(?:<img .*?><\/span>)?\s+|(自己))(?: \+([\d]+) HP)?(?: \+([\d]+) (?:法力|神力|怒气))?(?:(<br>)|$)/],
        Text_Button_ExtraStat: ["Extra Stat",
        "额外统计"],
        Text_Button_EntireStat: ["Entire Extra Stat",
        "全城额外统计"],
        Text_Button_Show: ["Show",
        "显示"],
        Text_Button_Default: ["Default",
        "默认"],
        TextList_AttackType: [["melee", "ranged", "spell", "social", "ambush", "trap", "nature", "disease", "detonate", "disarm trap", "magic projectile", "curse", "scare"],
        ["近战", "远程", "魔法", "心理", "偷袭", "陷阱", "自然", "疾病", "爆破", "解除陷阱", "魔法投射", "诅咒", "恐吓", "冲击"]],
        TextList_HealType: [["heal"],
        ["治疗"]],
        TextList_BuffType: [["buff"],
        ["使用"]],
        TextList_WaitType: [["wait"],
        ["等待"]],
        TextList_HitType: [["failed", "success", "good success", "critical success"],
        ["闪避", "普通", "重击", "致命一击"]],
        Text_Loading: ["Loading",
        "载入中"],
        Text_Options: ["Options:",
        "选项:"],
        Text_DefaultMsg: ["All the data this script stored in your machine has been cleared.",
        "此脚本储存在你的机器上的所有数据已被清除。"],
        Text_Table_Ini: ["Initiative",
        "先攻权"],
        Text_Table_Attack: ["Attack",
        "攻击骰"],
        Text_Table_Defence: ["Defence",
        "防御骰"],
        Text_Table_Damage: ["Damage",
        "伤害"],
        Text_Table_DamageType: ["Damage Type",
        "伤害类型"],
        Text_Table_HealType: ["Heal Type",
        "治疗类型"],
        Text_Table_Heal: ["Healing By The Hero",
        "给予治疗"],
        Text_Table_Healed: ["Healing On The Hero",
        "接受治疗"],
        Text_Table_DamagedItems: ["Damaged Items",
        "物品损坏"],
        Text_Table_Char: ["Character",
        "人物"],
        Text_Table_AttackType: ["Attack type",
        "攻击类型"],
        Text_Table_DefenceType: ["Defence type",
        "防御类型"],
        Text_Table_Skill: ["Skill",
        "技能"],
        Text_Table_Item: ["Item",
        "物品"],
        Text_Table_Position: ["Pos",
        "位置"],
        Text_Table_AvgRoll: ["Average roll",
        "平均值"],
        Text_Table_MaxRoll: ["Max roll",
        "Max值"],
        Text_Table_MinRoll: ["Min roll",
        "Min值"],
        Text_Table_STDRoll: ["STD roll",
        "STD值"],
        Text_Table_Times: ["Times",
        "次数"],
        Text_Table_RollList: ["Roll list",
        "数值列表"],
        Text_Table_ItemDamagePoints: ["Damage Points",
        "损坏点数"],
        Text_Table_AllData: ["All",
        "全部"]
    };

    var Style = "div.stat_all {font-size:14px;} " +
	     "div.stat_header {margin:1em auto 0.5em auto;} " +
        "span.stat_title {margin: auto 1em auto 0em; font-size:20px; font-weight:bold; color:#FFF;} span.clickable {cursor:pointer;} " +
        "table[hide] {display:none;} " +
        "table.pair_value {width:100%;} table.pair_value td {width:50%; min-width:3em; text-align:right; color:#F8A400;} table.pair_value td + td {color:#00CC00;} ";

    var Local;
    var Stat;

    if (typeof(GM_addStyle) == 'undefined') {
        function GM_addStyle(styles) {
            var S = document.createElement('style');
            S.type = 'text/css';
            var T = '' + styles + '';
            T = document.createTextNode(T)
            S.appendChild(T);
            document.body.appendChild(S);
            return;
        }
    }

    // FUNCTIONS //////////////////////////////////////////////////////////////////
    if (!this.GM_getValue || this.GM_getValue.toString().indexOf("not supported") > -1) {
        this.GM_getValue = function(key, def) {
            return localStorage[key] || def;
        };
        this.GM_setValue = function(key, value) {
            return localStorage[key] = value;
        };
    }

    function CreateStat(node, isExport) {
        // Stat initialization
        var theStat = new CStat(node);
        theStat.RegInfoList(new CILIni(CVLNumber, isExport));
        theStat.RegInfoList(new CILAttackRoll(CVLNumber, isExport));
        theStat.RegInfoList(new CILDefenceRoll(CVLNumber, isExport));
        theStat.RegInfoList(new CILDamage(CVLDamage, isExport));
        theStat.RegInfoList(new CILHeal(CVLNumber, isExport));
        theStat.RegInfoList(new CILHealed(CVLNumber, isExport));
        theStat.RegInfoList(new CILItemDamage(CVLNumber, isExport));
        return theStat;
    }

    function Main() {
        // Language selection
        Local = GetLocalContents(Contents);
        if (Local === null) return;
        //GM_log(Local);
        // Add CSS
        GM_addStyle(Style);

        // Add buttons
        var KeyButton = AddButtonBesideDisabledButton(
  [Local.OrigText_Button_DungeonDetails, Local.Text_Button_ExtraStat, OnCountStat], [Local.OrigText_Button_DungeonStat, Local.Text_Button_EntireStat, OnCountEntireStat], [Local.OrigText_Button_DuelDetails, Local.Text_Button_ExtraStat, OnCountStat]);
        if (KeyButton === null) return;

        // Stat initialization
        Stat = CreateStat(node_after(KeyButton.parentNode), false);
    }


    // It will only add the first eligible button
    // return: the node of the first eligible disabled button, or null if didn't find anyone
    function AddButtonBesideDisabledButton( /* [DisabledButtonText, ButtonText, ClickEvent], [...], ... */ ) {
        var allInputs = document.getElementsByTagName("input");
        for (var i = 0; i < allInputs.length; ++i) {
            if (allInputs[i].className == "button_disabled") {
                for (var j = 0; j < arguments.length; ++j) {
                    if (allInputs[i].getAttribute("value") == arguments[j][0]) {
                        AddButton(allInputs[i], arguments[j][1], arguments[j][2]);
                        return allInputs[i];
                    }
                }
            }
        }
        return null;
    }


    // Add a button to the end of the given node's parent node
    function AddButton(SiblingNode, Value, OnClick) {
        var newButton = document.createElement("input");
        newButton.setAttribute("type", "button");
        newButton.setAttribute("class", "button");
        newButton.setAttribute("value", Value);
        newButton.addEventListener("click", OnClick, false);
        var newBlank = document.createTextNode("            ");
        SiblingNode.parentNode.appendChild(newBlank);
        SiblingNode.parentNode.appendChild(newButton);
    }


    function OnCountStat() {
        try {
            if (this.className == "button_disabled")
                return;
            else
                this.className = "button_disabled";

            Stat.nTotalPages = 1;
            ReadPage(document, true);
        } catch (e) {
            alert("OnCountStat(): " + e);
        };
    }


    function OnCountEntireStat() {
        try {
            if (this.className == "button_disabled")
                return;
            else
                this.className = "button_disabled";

            CountEntireStat();
        } catch (e) {
            alert("OnCountEntireStat(): " + e);
        };
    }


    function CountEntireStat() {
        var nCurrRepId = GetHiddenInfo(document, "report_id[0]", "");
        var nMaxLevel = Stat.nTotalPages = GetStatPageMaxLevel(document, 1);

        for (var CurrLevel = 1; CurrLevel <= nMaxLevel; ++CurrLevel)
            GetPage(nCurrRepId, CurrLevel, 1, true);

        Stat.ShowProgress();
    }


    function GetPage(nRepId, nLevel, nRepPage, bFirstRead) {
        var XmlHttp = new XMLHttpRequest();

        XmlHttp.onreadystatechange = function() {
            try {
                if (XmlHttp.readyState == 4 && XmlHttp.status == 200) {
                    var Page = document.createElement("div");
                    Page.innerHTML = XmlHttp.responseText;
                    ReadPage(Page, bFirstRead);
                }
            } catch (e) {
                alert("XMLHttpRequest.onreadystatechange(): " + e);
            }
        };

        var URL = location.protocol + "//" + location.host + "/wod/spiel/dungeon/report.php" +
            "?cur_rep_id=" + nRepId +
            "&gruppe_id=&current_level=" + nLevel +
            "&REPORT_PAGE=" + nRepPage +
            "&IS_POPUP=1";

        XmlHttp.open("GET", URL, true);
        XmlHttp.send(null);
    }


    function ReadPage(page, bFirstRead) {
        var ret = GetRepPageInfo(page, [1, 1]);
        var nCurrRepPage = ret[0];
        var nMaxRepPage = ret[1];

        if (bFirstRead && nMaxRepPage > 1) {
            var nRepId = GetHiddenInfo(page, "report_id[0]", "");
            var nLevel = GetHiddenInfo(page, "current_level", 1);

            Stat.nTotalPages += nMaxRepPage - 1;
            for (var i = 1; i <= nMaxRepPage; ++i) {
                if (i !== nCurrRepPage)
                    GetPage(nRepId, nLevel, i, false);
            }
        }

        CountStat(page, (nCurrRepPage === nMaxRepPage));
        if (++Stat.nReadPages >= Stat.nTotalPages)
            Stat.Show();
        else
            Stat.ShowProgress();
    }


    function GetHiddenInfo(page, InfoName, DefaultValue) {
        var allInputs = page.getElementsByTagName("input");
        for (var i = 0; i < allInputs.length; ++i) {
            if (allInputs[i].getAttribute("type") == "hidden" &&
                allInputs[i].name == InfoName)
                return allInputs[i].value;
        };
        return DefaultValue;
    }


    function GetStatPageMaxLevel(page, DefaultValue) {
        var allTds = page.getElementsByTagName("td");
        for (var i = 0; i < allTds.length; ++i) {
            if (first_child(allTds[i].parentNode) != allTds[i])
                continue;
            var LevelNode = first_child(allTds[i]);
            if (LevelNode != null && LevelNode.nodeType == Node.TEXT_NODE && LevelNode.data == Local.OrigText_Level) {
                var Patt_Level = /^(?:<span .*?>)?(?:[\d]+)\/([\d]+)(?:<\/span>)?$/;
                var result = Patt_Level.exec(node_after(allTds[i]).innerHTML);
                if (result == null) return DefaultValue;
                return Number(result[1]);
            }
        }
        return DefaultValue;
    }


    // return: an array, [0]: nCurrRepPage, [1]: nMaxRepPage
    function GetRepPageInfo(page, DefaultValue) {
        var ret = [DefaultValue[0], DefaultValue[1]];
        var allInputs = page.getElementsByTagName("input");
		var IndexPatt = /=([\d]+)=/;
		var pages = [];
        for (var i = 0; i < allInputs.length; ++i) {
            var theInput = allInputs[i];
			if(theInput.className == "paginator_selected clickable")
			{
				var Result = IndexPatt.exec(theInput.value);
				pages.push(Number(Result[1]));
				ret[0] = Number(Result[1]);
			}
		}
        allInputs = page.getElementsByTagName("a");
        for (var i = 0; i < allInputs.length; ++i) {
            var theInput = allInputs[i];
			if(theInput.className == "paginator")
			{
				var Result = IndexPatt.exec(theInput.textContent);
				pages.push(Number(Result[1]));
			}
		} 		
		if(pages.length > 0)
			ret[1] = Math.max.apply(Math, pages);

        return ret;
    }

    //===============================================================================================
    // code for save report only.
    //===============================================================================================

    var StatEntire;
    var StatEntireDiv;

    function es_addStyle(page, styles) {
        var S = document.createElement('style');
        S.type = 'text/css';
        var T = '' + styles + '';
        T = document.createTextNode(T)
        S.appendChild(T);
        page.appendChild(S);
        return;
    }

    function InsertButton(Node, Value, OnClick) {
        var newButton = document.createElement("input");
        newButton.setAttribute("type", "button");
        newButton.setAttribute("class", "button");
        newButton.setAttribute("value", Value);
        newButton.addEventListener("click", OnClick, false);
        Node.parentNode.insertBefore(newButton, Node.nextSibling);
    }

    function changeAllSelection(select) {
        var allCheckbox = document.getElementsByTagName("input");
        for (var i = 0; i < allCheckbox.length; ++i) {
            var theCheckbox = allCheckbox[i];
            if (rValue.Pattern_checkboxName.test(theCheckbox.getAttribute("name"))) {
                theCheckbox.checked = select;
            }
        }
    }

    function selectAll() {
        if (!gIsWorking)
            changeAllSelection(true);
    }

    function cleartAll() {
        if (!gIsWorking)
            changeAllSelection(false);
    }

    function exportLog() {
        if (gIsWorking && !DEBUG)
            return;
        gIsWorking = true;
		var includeCheckbox = document.getElementById(rValue.Chk_includeData);
		includeData = includeCheckbox.checked;
        var allCheckbox = document.getElementsByTagName("input");
        gZip = new JSZip();
        gSelectedReport = [];
        for (var i = 0; i < allCheckbox.length; ++i) {
            var theCheckbox = allCheckbox[i];
            if (rValue.Pattern_checkboxName.test(theCheckbox.getAttribute("name"))) {
                if (theCheckbox.checked) {
                    gSelectedReport.push(theCheckbox);
                }
            }
        }

        if (gSelectedReport.length > 0) {
            gTitle = window.prompt("输入战报名称", "我的战报");
			headDiv = document.getElementsByTagName('head')[0].cloneNode(true);
			handleHead(headDiv);

			gIndexDiv = gIndexTemplateDiv.cloneNode(true);
            var table = document.createElement("div");
            gCurrentReport = gSelectedReport[0];
            StatEntireDiv = document.createElement("div");
            if(includeData)
			{
				StatEntireDiv = document.createElement("div");
				StatEntire = CreateStat(StatEntireDiv, true);
			}
            GetLevelPage(1, 1);
        } else {
            window.alert("没有选择任何战报");
        }
    }

    function GetLevelPage(nLevel, nRepPage) {
        var XmlHttp = new XMLHttpRequest();

        XmlHttp.onreadystatechange = function() {
            try {
                if (XmlHttp.readyState == 4 && XmlHttp.status == 200) {
                    gResponseDiv.innerHTML = XmlHttp.responseText;
                    ReadLevelPage(nLevel, nRepPage);
                }
            } catch (e) {
                alert("GetLevelPage XMLHttpRequest.onreadystatechange(): " + e);
            }
        };

        var URL = location.protocol + "//" + location.host + "/wod/spiel/dungeon/report.php" +
            "?cur_rep_id=" + gCurrentReport.value +
            "&gruppe_id=&current_level=" + nLevel +
            "&REPORT_PAGE=" + nRepPage +
            "&IS_POPUP=1";

        XmlHttp.open("GET", URL, true);
        XmlHttp.send(null);
    }

    function ReadLevelPage(nLevel, nRepPage) {
        if (nLevel == 1) {
            gCurrentReport.setAttribute("maxLevel", GetMaxLevel(gResponseDiv, 1));
            var rows = gIndexDiv.getElementsByTagName("tr");
            var row = rows[rows.length - 1];
            row.parentNode.appendChild(row.cloneNode(true));

            row.setAttribute("class", gIndexRowclass);
            if (gIndexRowclass == "row0")
                gIndexRowclass = "row1";
            else
                gIndexRowclass = "row0";
            row.cells[0].innerHTML = replaceDate(gCurrentReport.getAttribute("reporttime"));
            row.cells[1].innerHTML = gCurrentReport.getAttribute("reportname");
            var cell = row.cells[2];

            cell.innerHTML = "";
            addIndexNewButton(cell, "统计表", "document.location.href='" + gCurrentReport.value + "/statistics.html';");
            addIndexNewButton(cell, "获得物品", "document.location.href='" + gCurrentReport.value + "/items.html';");
            for (var i = 1; i <= gCurrentReport.getAttribute("maxLevel"); i++) {
                addIndexNewButton(cell, "层 " + i, "document.location.href='" + gCurrentReport.value + "/level" + i + ".html';");
            }
        }
        var ret = GetRepPageInfo(gResponseDiv, [1, 1]);
        var nCurrRepPage = ret[0];
        var nMaxRepPage = ret[1];

        if (includeData && nCurrRepPage == 1) {
            Stat = CreateStat(node_before(gResponseDiv.getElementsByTagName("h2")[0].nextSibling), true);
            Stat.nTotalPages = nMaxRepPage;
        }
		if(nMaxRepPage > 1)
		{
			var copyDiv = document.createElement("div");
			copyDiv.innerHTML = gResponseDiv.innerHTML;
			multiPageDiv.push(copyDiv);
		}
		else
			multiPageDiv.push(gResponseDiv);
		
        var maxLevel = gCurrentReport.getAttribute("maxLevel");
        infodiv.innerHTML = "保存战报：&nbsp;" + gTitle + "<br/>" + gCurrentReport.getAttribute("title") + " - 第 " + nLevel + "/" + maxLevel + " 层详细资料";

        if(includeData)
			CountStat(gResponseDiv, (nCurrRepPage === nMaxRepPage), true);
        if(nCurrRepPage === nMaxRepPage)
		{
			for(var i = 0; i< multiPageDiv.length ; i++)
			{
				var thepage = multiPageDiv[i];
				var theFileName = gCurrentReport.value + "/level" + nLevel + ".html";
				if (i > 0) {
					theFileName = gCurrentReport.value + "/level" + nLevel + "_" + (i+1) + ".html";
				}
				if(includeData)
				{
					Stat.setNode(node_before(thepage.getElementsByTagName("h2")[0].nextSibling));				
					Stat.Export();
				}
				gZip.file(theFileName, handlePage(thepage,nLevel));
			}
			multiPageDiv = [];
		}

        if (nCurrRepPage < nMaxRepPage)
            GetLevelPage(nLevel, nCurrRepPage + 1);
        else if (nLevel < maxLevel)
            GetLevelPage(nLevel + 1, 1);
        else
            GetStatPage();
    }

    function GetStatPage() {
        var queryString = $("form[name='the_form']").formSerialize() + "&IS_POPUP=1&" + gCurrentReport.getAttribute(rValue.Text_Stat) + "=" + rValue.Text_Stat;
        var XmlHttp = new XMLHttpRequest();

        XmlHttp.onreadystatechange = function() {
            try {
                if (XmlHttp.readyState == 4 && XmlHttp.status == 200) {
                    gResponseDiv.innerHTML = XmlHttp.responseText;
                    infodiv.innerHTML = "保存战报：&nbsp;" + gTitle + "<br/>" + gCurrentReport.getAttribute("title") + " - 统计表";
                    if(includeData)
					{
						StatEntire.setNode(node_before(gResponseDiv.getElementsByTagName("h2")[0].nextSibling));
						StatEntire.Export();
					}
                    gZip.file(gCurrentReport.value + "/statistics.html", handlePage(gResponseDiv));
                    GetItemPage();
                }
            } catch (e) {
                alert("GetItemPage XMLHttpRequest.onreadystatechange(): " + e);
            }
        };

        var URL = location.protocol + "//" + location.host + "/wod/spiel/dungeon/report.php";

        XmlHttp.open("POST", URL, true);
        XmlHttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        XmlHttp.setRequestHeader("Content-length", queryString.length);
        XmlHttp.setRequestHeader("Connection", "close");
        XmlHttp.send(queryString);
    }

    function GetItemPage() {
        var queryString = $("form[name='the_form']").formSerialize() + "&IS_POPUP=1&" + gCurrentReport.getAttribute(rValue.Text_Item) + "=" + rValue.Text_Item;
        var XmlHttp = new XMLHttpRequest();

        XmlHttp.onreadystatechange = function() {
            try {
                if (XmlHttp.readyState == 4 && XmlHttp.status == 200) {
                    gResponseDiv.innerHTML = XmlHttp.responseText;
                    infodiv.innerHTML = "保存战报：&nbsp;" + gTitle + "<br/>" + gCurrentReport.getAttribute("title") + " - 获得物品";
                    gZip.file(gCurrentReport.value + "/items.html", handlePage(gResponseDiv));
                    gCurrentReport.checked = false;
                    for (var i = 0; i < gSelectedReport.length; ++i) {
                        var theCheckbox = gSelectedReport[i];
                        if (theCheckbox.checked) {
                            gCurrentReport = theCheckbox;
                            GetLevelPage(1, 1);
                            return;
                        }
                    }
                    handleIndexPage();
                    infodiv.innerHTML = "保存战报：&nbsp;" + gTitle + "<br/>" + "生成Zip文件";
                    var indexStr = '<html>\n' + headDiv.outerHTML + '\n<body>\n' + gIndexDiv.innerHTML + '\n</body>\n</html>';
                    gZip.file("index.html", indexStr);
                    var blob = gZip.generate({
                        type: "blob"
                    });
                    saveAs(blob, "wodlog" + '_' + Math.random().toString(36).substr(2, 9) + ".zip");
                    alert('zip文件生成完毕');
                    infodiv.innerHTML = "";
                    gResponseDiv.innerHTML = "";
                    gIsWorking = false;
                }
            } catch (e) {
                alert("GetItemPage XMLHttpRequest.onreadystatechange(): " + e);
            }
        };

        var URL = location.protocol + "//" + location.host + "/wod/spiel/dungeon/report.php";

        XmlHttp.open("POST", URL, true);
        XmlHttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        XmlHttp.setRequestHeader("Content-length", queryString.length);
        XmlHttp.setRequestHeader("Connection", "close");
        XmlHttp.send(queryString);
    }

    function GetMaxLevel(page, DefaultValue) {
        var ret = DefaultValue;

        var allInputs = page.getElementsByTagName("input");
        for (var i = 0; i < allInputs.length; ++i) {
            var name = allInputs[i].getAttribute("name");

            if (rValue.Pattern_level.test(name)) {
                var levelnumber = Number(rValue.Pattern_idNumber.exec(name)[1]);
                if (levelnumber > ret)
                    ret = levelnumber;
            }
        }
        return ret;
    }

    function handlePage(page,nLevel) {

		var thepage = page.getElementsByTagName("form")[0];
        var h2 = thepage.getElementsByTagName("h2")[0];
        if (h2) {
            h2.innerHTML = replaceDate(h2.innerHTML);
        }
		
		removePageInput(thepage);
        replaceURL(thepage, "link", "href");
        replaceURL(thepage, "script", "src");
        replaceURL(thepage, "img", "src");
        replaceURL(thepage, "a", "href", "#");
        replaceButton(thepage);
		if(nLevel)
			replaceLevelPage(thepage,nLevel);
        return '<html>\n' + headDiv.outerHTML + '\n<body>\n' + replaceOther(thepage.outerHTML) + '\n</body>\n</html>';
    }
	
	function handleHead(head) {
        if (gTitle == null)
            gTitle = "我的战报";
        head.getElementsByTagName('title')[0].innerHTML = gTitle;

        replaceURL(head, "link", "href");
		
		var bodyScript = document.getElementsByTagName('body')[0].cloneNode(true).getElementsByTagName("script");
		for(var i=0;i<bodyScript.length;i++)
			head.appendChild(bodyScript[i]);
		var scripts = head.getElementsByTagName("script");
		for(var i=scripts.length-1;i>=0;i--)
		{
			script = scripts[i];
			handleScript(script);
		}
		replaceURL(head, "script", "src");
		
		var metas = head.getElementsByTagName("meta");
		for(var i = metas.length-1;i>=0; i--)
		{
			var meta = metas[i];
			if(!meta.httpEquiv)
				meta.parentNode.removeChild(meta);
		}
		if(includeData)
			es_addStyle(head,Style);
		head.innerHTML = head.innerHTML + "\n";		
        return head;
    }

	function handleScript(script)
	{
		var patten = /wod_standard.js|wodtooltip.js/;
		var scriptPatten = /(wodToolTipInit\(.*\);)\s*(wodInitialize\([^;]*\);)/;
		if(script.src)
		{
			if(!patten.test(script.src))
				script.parentNode.removeChild(script);
		}
		else if(script.firstChild)
		{
			var scriptStr = script.firstChild.data;
			var result = scriptPatten.exec(scriptStr);
			if(result[1] && result[2])
				scriptStr = "window.onload = function(e){" + result[1] + result[2] + "}";
			
			scriptStr = scriptStr.replace(/wodInitialize\(''/g, "wodInitialize('" + location.host + "'").replace("'0'","'1'");
			scriptStr += '\nfunction o(t,n){ \n var url="' + location.origin + '/wod/spiel/";\n';
			scriptStr += 'if(t=="n"){url += "help/npc"}\n';
			scriptStr += 'if(t=="s"){url += "hero/skill"}\n';
			scriptStr += 'if(t=="i"){url += "hero/item"}\n';
			scriptStr += 'return wo(url + ".php?name=" + n + "&IS_POPUP=1");}\n';
			
			if(includeData)
			{
				scriptStr +='var CTable=function(){};\n';
				scriptStr +='CTable.GetNumber = ' + CTable.GetNumber.toString() + '\n';
				scriptStr +='CompareString = ' + CompareString.toString() + '\n';
				scriptStr +='ct = ' + CTable.OnClickTitle.toString() + '\n';
				scriptStr +='cf = ' + CTable.OnChangeFilter.toString() + '\n';
				scriptStr +='co = ' + CTable.OnChangeOrder.toString() + '\n';
			}
			script.firstChild.data = scriptStr;										
		}

	}
    function removePageInput(page) {
        var inputs = page.getElementsByTagName("input");
        for (var i = inputs.length-1; i >=0;i--) {
            var theInput = inputs[i];
            if (theInput.type == "hidden") {
                theInput.parentNode.removeChild(theInput);
                break;
            }
        }
        return page
    }

    function replaceURL(page, tag, attr, value) {
        var test_pattern = /^\//;
        var test1_pattern = /^#/;
		var onclick_pattern = /([^\/]*)\.php\?name=([^&]*)/;
        var allLink = page.getElementsByTagName(tag);
		var path = location.origin + location.pathname;
		var m = path.match(/(.*)[\/\\]([^\/\\]+)\.\w+$/);

        for (var i = 0; i < allLink.length; i++) {
            var link = allLink[i];
            if (link.hasAttribute(attr)) {
                var uri = link.getAttribute(attr);
				if(value)
				{
					if (!test1_pattern.test(uri))
						link.setAttribute(attr, value);
					if(link.hasAttribute('onclick'))
					{
						var result = onclick_pattern.exec(link.getAttribute('onclick'));
						if(result && result[1] && result[2])
							link.setAttribute('onclick',"return o('" + result[1].substr(0,1) + "','" + result[2] + "');");
					}
				}
				else
				{
					if (!rValue.pattern_http.test(uri)) {
						if (test_pattern.test(uri)) {
							link.setAttribute(attr, location.origin + uri);
						} else if (!test1_pattern.test(uri)) {
							link.setAttribute(attr, m[1] + "/" + uri);
						}
					}
				}
            }
        }
    }

    function replaceButton(page) {
        var allInputs = page.getElementsByTagName("input");
        for (var i = 0; i < allInputs.length; ++i) {
            var name = allInputs[i].getAttribute("name");

            if (rValue.Pattern_level.test(name)) {
                var levelURL = "document.location.href='level" + rValue.Pattern_idNumber.exec(name)[1] + ".html';";
                var button = allInputs[i];
                button.setAttribute("type", "button");
                button.setAttribute("onclick", levelURL);
            }
            if (rValue.Pattern_item.test(name)) {
                var levelURL = "document.location.href='items.html';";
                var button = allInputs[i];
                button.setAttribute("type", "button");
                button.setAttribute("onclick", levelURL);
            }
            if (rValue.Pattern_stat.test(name)) {
                var levelURL = "document.location.href='statistics.html';";
                var button = allInputs[i];
                button.setAttribute("type", "button");
                button.setAttribute("onclick", levelURL);
            }
            if (rValue.Pattern_detail.test(name)) {
                var levelURL = "document.location.href='level1.html';";
                var button = allInputs[i];
                button.setAttribute("type", "button");
                button.setAttribute("onclick", levelURL);
            }
            if (name == "overview" || name == "") {
                var levelURL = "document.location.href='../index.html';";
                var button = allInputs[i];
                button.setAttribute("type", "button");
                button.setAttribute("onclick", levelURL);
            }
        }
    }
	function replaceLevelPage(page,nLevel)
	{
		var IndexPatt = /=([\d]+)=/;
        allURL = page.getElementsByTagName("a");
        for (var i = 0; i < allURL.length; ++i) {
            var theURL = allURL[i];
			if(theURL.className == "paginator")
			{
				var Result = IndexPatt.exec(theURL.textContent);
				var pageNum = Number(Result[1]);
				theURL.href = "level" + nLevel + (pageNum > 1? "_" + pageNum:"") + ".html";
			}
		}
	}
    
	function replaceDate(sDate) {
        var today = new Date();
        var yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        var ret = sDate.replace("今天", today.getFullYear() + '年' + (today.getMonth() + 1) + '月' + today.getDate() + '日');
        ret = ret.replace("昨天", yesterday.getFullYear() + '年' + (yesterday.getMonth() + 1) + '月' + yesterday.getDate() + '日');
        return ret;
    }

    function replaceOther(sHTML) {
        var ret = sHTML.replace(/wodInitialize\(''/g, "wodInitialize('" + location.host + "'");
        ret = ret.replace(/wo\('\/wod/g, "wo('" + location.origin + "/wod");
        return ret;
    }
	

    function prepareIndexPageTemplate() {
        var allRow = gIndexTemplateDiv.getElementsByTagName("tr");
        for (var j = allRow.length - 1; j > 1; --j) {
            var row = allRow[j];
            if (rValue.Pattern_logRow.test(row.getAttribute("class"))) {
                row.parentNode.removeChild(row);
            }
        }
    }

    function addIndexNewButton(cell, buttonText, url) {
        var newButton = document.createElement("input");
        newButton.setAttribute("type", "button");
        newButton.setAttribute("class", "button clickable");
        newButton.setAttribute("value", buttonText);
        newButton.setAttribute("onclick", url);
        cell.appendChild(newButton);
    }

    function handleIndexPage() {
        var allRow = gIndexDiv.getElementsByTagName("tr");
        var row = allRow[allRow.length - 1];
        row.parentNode.removeChild(row);
    }

    var gIndexRowclass = "row0";
    var gCurrentReport;
    var gZip;
    var rLocal;
    var infodiv;
    var gTitle;
    var gSelectedReport = [];
    var gIndexTemplateDiv;
    var gResponseDiv;
	var multiPageDiv = [];
    var gIndexDiv;
    var gIsWorking = false;
	var includeData = false;
	var headDiv;
	var world = "";
    var rContents = {
        OrigText_H1_DungeonLog: ["Battle Report",
            "战报"
        ],
        OrigText_Button_DungeonDetails: ["details",
            "详细资料"
        ],
        Text_Button_Exportlog: ["Export Log",
            "导出战报"
        ],
        Text_Button_SelectAll: ["Select All",
            "全选"
        ],
        Text_Button_ClearAll: ["Clear All",
            "清除"
        ]

    };

    var rValue = {
            Text_Item: "items",
            Text_Stat: "stats",
            Text_Checkbox: "chkLog",
			Chk_includeData: "export_with_data",
            Pattern_level: /^level\[[\d]+\]/,
            Pattern_stat: /^stats\[[\d]+\]/,
            Pattern_item: /^items\[[\d]+\]/,
            Pattern_detail: /^details\[[\d]+\]/,
            Pattern_checkboxName: /^chkLog/,
            Pattern_logRow: /^row\d/,
            Pattern_idNumber: /([\d]+)/,
            pattern_http: /^http/i
        };
        //-----------------------------------------------------------------------------
        // "main"
        //-----------------------------------------------------------------------------    

    function ReprotMain() {
        rLocal = GetLocalContents(rContents);
        if (rLocal === null) return;
        var allH1 = document.getElementsByTagName("h1");
        var i = 0;
        var h1;
        var shouldContinue = false;
        if (allH1 === 'undefined')
            return;
        for (i = 0; i < allH1.length; ++i) {
            h1 = allH1[i];
            if (h1.innerHTML == rLocal.OrigText_H1_DungeonLog) {
                infodiv = document.createElement("div");
                infodiv.innerHTML = "";
                h1.parentNode.insertBefore(infodiv, h1.nextSibling);
				var newSpan = document.createElement("span");
				newSpan.innerHTML = "同时保存统计信息";
				h1.parentNode.insertBefore(newSpan, h1.nextSibling);
				var newCheckBox = document.createElement("input");
				newCheckBox.setAttribute("type", "checkbox");
				newCheckBox.setAttribute("class", "checkbox");
				newCheckBox.setAttribute("value", "同时保存统计信息");
				newCheckBox.id = "export_with_data";
				h1.parentNode.insertBefore(newCheckBox, h1.nextSibling);
                InsertButton(h1, rLocal.Text_Button_Exportlog, exportLog);
                InsertButton(h1, rLocal.Text_Button_ClearAll, cleartAll);
                InsertButton(h1, rLocal.Text_Button_SelectAll, selectAll);

				
				
                gResponseDiv = document.createElement("div");
                gResponseDiv.innerHTML = "";
                gIndexTemplateDiv = document.createElement("div");
                gIndexTemplateDiv.innerHTML = "";

                shouldContinue = true;
                break;
            }
        }
        if (!shouldContinue)
            return;
        var allTable = document.getElementsByTagName("table");
        for (i = 0; i < allTable.length; ++i) {
            var theTable = allTable[i];
            if (theTable.getAttribute("class") == "content_table") {
                gIndexTemplateDiv.innerHTML = theTable.outerHTML;
                prepareIndexPageTemplate();
                var allRow = theTable.getElementsByTagName("tr");
                for (var j = 0; j < allRow.length; ++j) {
                    var row = allRow[j];
                    var newCheckbox = document.createElement("input");
                    newCheckbox.setAttribute("type", "checkbox");
                    if (rValue.Pattern_logRow.test(row.getAttribute("class"))) {
                        var reportName = "<span>" + row.cells[1].firstChild.innerHTML + "</span>";
                        var reportTime = "<span>" + row.cells[0].firstChild.innerHTML + "</span>";
                        var title = reportName + "&nbsp;-&nbsp;" + reportTime;
                        var allInput = row.cells[2].getElementsByTagName("input");
                        var id = "";
                        var index = "";
                        for (var k = 0; k < allInput.length; ++k) {
                            var input = allInput[k];
                            var name = input.getAttribute("name");
                            var value = input.getAttribute("value");
                            if (name.indexOf("report_id") != -1) {
                                var Result = rValue.Pattern_idNumber.exec(name);
                                index = Number(Result[1]);
                                id = value;
                                break;
                            }
                        }
                        newCheckbox.setAttribute("name", rValue.Text_Checkbox + "[" + index + "]");
                        newCheckbox.setAttribute("id", rValue.Text_Checkbox + "[" + index + "]");
                        newCheckbox.setAttribute("value", id);
                        newCheckbox.setAttribute("title", title);
                        newCheckbox.setAttribute("reportname", reportName);
                        newCheckbox.setAttribute("reporttime", reportTime);
                        newCheckbox.setAttribute("maxLevel", 1);
                        newCheckbox.setAttribute(rValue.Text_Item, rValue.Text_Item + "%5B" + index + "%5D");
                        newCheckbox.setAttribute(rValue.Text_Stat, rValue.Text_Stat + "%5B" + index + "%5D");
                        row.cells[0].insertBefore(newCheckbox, row.cells[0].firstChild);
                    }
                }
                break;
            }
        }
		var allInput = document.getElementsByTagName("input");
		for(var i=0;i<allInput.length;i++)
		{
			var input = allInput[i];
			if(input.name && input.name == "wod_post_world")
			{
				world = input.value;
				break;
			}
		}
    }

    try {
        Main();
        ReprotMain();
    } catch (e) {
        alert("Main(): " + e);
    }
})()