# GSHHG 2.3.7 data notice

TerraDash application source remains MIT-licensed. GSHHG is a separate data component and the
pinned `gshhg-shp-2.3.7.zip` archive states that GSHHG is distributed under the GNU Lesser General
Public License version 3 or later, together with the additional permission/notice reproduced in
`LICENSE.TXT`. The corresponding LGPL text is preserved in `COPYING.LESSERv3`.

Pinned archive SHA-256:

`8dbbe7e071e77e9e75f2d639239099ebca8d5c16d6a07df8169729d49f15cf41`

TerraDash does not redistribute GSHHG polygon geometry in the committed island ranking exports.
The exporter reads the unmodified high-resolution level 1/3 polygon files and derives only a
coordinate-to-source-polygon mapping plus source IDs/hierarchy/provenance fields. This mapping is a
TerraDash-generated modification/derivative metadata product. If GSHHG geometry is redistributed in
a future artifact, preserve these notices and clearly identify any geometry modifications as well.
