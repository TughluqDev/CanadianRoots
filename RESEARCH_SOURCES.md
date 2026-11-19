# Research Sources: `data/researched_experiences.json`

## Tooling
- **Firecrawl was not connected** in this environment (no Firecrawl MCP server or API key). Research used Claude Code's built-in WebSearch and WebFetch tools instead. To use Firecrawl in a future refresh, add its MCP server with a `FIRECRAWL_API_KEY` (see Firecrawl's official MCP setup instructions). The running app never calls Firecrawl or any research service.
- Research is separate from app startup. The app only reads the committed JSON through `scripts/seed_database.py`.

## Post-research review (by the integrating engineer)
- Independently re-checked against official pages on 2026-11-18:
  - Doon Heritage Village: $15 adult, "all rates plus HST".
  - Ukrainian Cultural Heritage Village: $18 adult, closed until May 2027.
- Removed the `british` label from Doon Heritage Village. Its own sources describe Pennsylvania German Mennonite and German settlement, not British settlement.
- Some "verified" prices exclude HST/GST. The app uses published prices as-is and says so in the budget's tax note.
- Images are openly licensed Commons files. `scripts/fetch_images.py` caches them locally (it was rate-limited by Wikimedia during setup and retries with backoff). Author and licence appear on each destination card. Any image that is missing or fails to load is replaced with a designed illustration.

Researched 2026-11-18. The dataset has 25 destinations. Each record lists its own `sources` and `pricing.source_url`.

## Process
1. I started from the lead list and added more sites where coverage was thin.
2. I fetched each official website directly to confirm three things: the place is operating, the activities listed are actually offered (and in which season), and the published prices.
3. Excluded: the Father Pandosy Mission's former domain (okanaganmission.com) has lapsed to a domain reseller. The site itself is still covered, using the Okanagan Historical Society page, which is the co-administrator. Heritage Park Calgary was dropped because its agricultural focus was weak and its pricing was ambiguous. Village Historique Acadien was dropped to keep the list at 25 and to tighten clusters. Davison Orchards was dropped because no cultural-heritage link could be documented. TH Farm (Tr'ondëk Hwëch'in) was not listed as a stop because it is a teaching farm with no public tours; it is mentioned in context only.
4. Coordinates came from OpenStreetMap Nominatim (named features or street addresses) or from Wikipedia coordinates. Two are approximate:
   - Dawson Farmers' Market uses the centroid of Front Street.
   - Rockpile Remedies uses the centroid of Eureka Drive.
5. Images came from the Wikimedia Commons API (imageinfo / extmetadata), with author and license taken from the file metadata. All 21 image URLs returned HTTP 200.

## Source types
- Official operator websites (museums, farms, a winery, an abbey, a sugar shack).
- Government sites: Parks Canada, Ingenium, Government of Alberta, Nova Scotia Museum, Town of Inuvik, City of Dawson, Tr'ondëk Hwëch'in Government, Travel Yukon, NWT Tourism.
- Heritage registers: Canada's Historic Places and UNESCO.
- Wikipedia, used only for supporting historical facts and coordinates.

## Pricing
- **Verified (18):** a published adult price was found on the official site. Note how some of these are defined:
  - Sucrerie de la Montagne: the price is for the sugar-shack meal.
  - Nk'Mip Cellars: the price is a tasting flight.
  - Abbaye de Saint-Benoît-du-Lac and Fromagerie La Station: the price is a guided tour. Visiting the shop and the self-guided route is free.
  - Pandosy Mission: the price is a suggested donation.
  - Fort Edmonton Park: the price is the fall/winter Indigenous Peoples Experience. The summer full-park price was not published.
- **Free (2):** Mādahòkì Farm general admission (add-ons are paid) and the Dawson City Farmers' Market.
- **Estimate (1):** Sainte-Marie among the Hurons, $15. Regular admission was not published in the off-season, so this is based on its published event price.
- **Unavailable (4):** Orwell Corner, Dänojà Zho, Rockpile Remedies and Inuvik Community Greenhouse.

## Limitations and gaps
- Many sites were closed for the season. For Upper Canada Village, Orwell Corner and Motherwell Homestead, 2027 season dates were not published, so their `available_months` are approximate. Each of these says so in `season_notes`.
- Orwell Corner's PEI Museum page blocks automated requests. It was read through a fetch tool, and no standard admission price was found.
- The Atlantic region has 4 sites (PEI 1, NS 2, NB 1) and nothing in Newfoundland and Labrador.
- The Northern region has nothing in Nunavut. It does include an Indigenous cultural centre that is not food-focused, plus two Dawson sites whose cultural classification is a loose fit. Rockpile Remedies and the Dawson Farmers' Market are labelled `immigrant` only because of the app's four categories; this is flagged in their `cultural_context`.
- The Inuvik greenhouse is community-run, not owned by any Nation. It is labelled `indigenous` because of its setting, and this is flagged.
- The Kilby family's origins are documented only back to Waterloo, Ontario. The `british` label means English-Canadian settler culture.
- Ukrainian Cultural Heritage Village has `food_spotlight: null` because no food offering could be verified.
- Images that are not of the site itself:
  - Mādahòkì Farm's image is a related subject: a Lac La Croix Indian Pony (Ojibwe horse) not photographed at the farm.
  - Mennonite Heritage Village's image is a generic village photo.
  - Kings Landing's image is low resolution (604 px).
- No image (4): Fromagerie La Station, Father Pandosy Mission, Dawson Farmers' Market and Rockpile Remedies.
