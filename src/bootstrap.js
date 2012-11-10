/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;

const RE_FILE = /^file:\/\//;
const RE_XPI = /\.xpi$/;
const INSTALL_RDF_ENTRY = "install.rdf";

var menuID;

function loadIntoWindow(window) {
  if (!window)
    return;

  window.console.log("mobile-installer@xulforge.com > Loading...");

  let label = "Install on Mobile";

  // Looks for file:// URLs that point to XPI files.
  let selector =  {
    matches : function (aElement) {
      let match =
        RE_FILE.test(aElement.ownerDocument.documentURI) &&
        ("a" == aElement.tagName.toLowerCase()) &&
        RE_XPI.test(aElement.getAttribute("href"));

      return match;
    }
  };

  menuID =
    window.NativeWindow.contextmenus.add(label, selector, function(aTarget) {
      window.console.log("mobile-installer@xulforge.com > Installing...");

      try {
        Components.utils.import("resource://gre/modules/NetUtil.jsm");

        let targetURL =
          aTarget.ownerDocument.documentURI + aTarget.getAttribute("href");
        let xpiFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        let zipRead =
          Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(Ci.nsIZipReader);
        let zipWrite =
          Cc["@mozilla.org/zipwriter;1"].createInstance(Ci.nsIZipWriter);
        let converter =
          Cc["@mozilla.org/intl/scriptableunicodeconverter"].
            createInstance(Ci.nsIScriptableUnicodeConverter);
        let installRDF;
        let rdfInputStream;
        let installRDFStr;

        // window.console.log("mobile-installer@xulforge.com > URL: " + targetURL);

        // Get the install.rdf file and read it into a string.
        xpiFile.initWithPath(targetURL.replace("file://", ""));
        zipRead.open(xpiFile);
        rdfInputStream = zipRead.getInputStream(INSTALL_RDF_ENTRY);
        installRDFStr =
          NetUtil.readInputStreamToString(
            rdfInputStream, rdfInputStream.available());
        rdfInputStream.close();
        zipRead.close();

        // window.console.log("mobile-installer@xulforge.com > install.rdf\n" + installRDFStr);

        // Replace Firefox with Firefox for Android.
        installRDFStr =
          installRDFStr.replace(
            "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}",
            "{aa3c5121-dab2-40e2-81ca-7ea25febc110}");

        // window.console.log("mobile-installer@xulforge.com > Writing...");

        // read/write, append.
        zipWrite.open(xpiFile, 0x04 | 0x10);

        // Remove the existing entry.
        zipWrite.removeEntry(INSTALL_RDF_ENTRY, false);
        // write the new one.
        converter.charset = "UTF-8";
        rdfInputStream = converter.convertToInputStream(installRDFStr);
        zipWrite.addEntryStream(
          INSTALL_RDF_ENTRY, Date.now(), Ci.nsIZipWriter.COMPRESSION_DEFAULT,
          rdfInputStream, false);
        rdfInputStream.close();
        zipWrite.close();

        // window.console.log("mobile-installer@xulforge.com > Done! Opening...");

        // Open the modified XPI for installation.
        window.BrowserApp.selectedTab.window.location = targetURL;
      } catch (e) {
        window.console.log("mobile-installer@xulforge.com > Error:\n" + e);
      }
    });

  window.console.log("mobile-installer@xulforge.com: Menu added.");
}

function unloadFromWindow(window) {
  if (!window)
    return;

  window.NativeWindow.contextmenus.remove(menuID);
}

var windowListener = {
  onOpenWindow: function(aWindow) {
    // Wait for the window to finish loading
    let domWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
    domWindow.addEventListener("load", function() {
      domWindow.removeEventListener("load", arguments.callee, false);
      loadIntoWindow(domWindow);
    }, false);
  },

  onCloseWindow: function(aWindow) {},
  onWindowTitleChange: function(aWindow, aTitle) {}
};

function startup(aData, aReason) {
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);

  // Load into any existing windows
  let windows = wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    loadIntoWindow(domWindow);
  }

  // Load into any new windows
  wm.addListener(windowListener);
}

function shutdown(aData, aReason) {
  // When the application is shutting down we normally don't have to clean
  // up any UI changes made
  if (aReason == APP_SHUTDOWN)
    return;

  let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);

  // Stop listening for new windows
  wm.removeListener(windowListener);

  // Unload from any existing windows
  let windows = wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    unloadFromWindow(domWindow);
  }
}

function install(aData, aReason) {}
function uninstall(aData, aReason) {}
