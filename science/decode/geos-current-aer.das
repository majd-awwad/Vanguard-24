Attributes {
    NC_GLOBAL {
        String title "GEOS5 FP 2d time-averaged primary aerosol diagnostics";
        String Conventions "COARDS", "GrADS";
        String dataType "Grid";
        String history "Sat Nov 14 11:02:24 EST 2026 : imported by GrADS Data Server 2.0";
        String extra_das_attribute "This is an example of metadata added using a supplementary DAS file. See testdata/extra.das for the source.";
    }
    lon {
        String grads_dim "x";
        String grads_mapping "linear";
        String grads_size "1152";
        String units "degrees_east";
        String long_name "longitude";
        Float64 minimum -180.00000000000;
        Float64 maximum 179.68750000000;
        Float32 resolution 0.3125;
    }
    lat {
        String grads_dim "y";
        String grads_mapping "linear";
        String grads_size "721";
        String units "degrees_north";
        String long_name "latitude";
        Float64 minimum -90.00000000000;
        Float64 maximum 90.00000000000;
        Float32 resolution 0.25;
    }
    time {
        String grads_dim "t";
        String grads_mapping "linear";
        String grads_size "2083";
        String grads_min "01:30z27feb2026";
        String grads_step "180mn";
        String units "days since 1-1-1 00:00:0.0";
        String long_name "time";
        String minimum "01:30z27feb2026";
        String maximum "07:30z14nov2026";
        Float32 resolution 0.125;
    }
    duangstr {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "dust angstrom parameter [470-870 nm] ";
    }
    sufluxv {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "so4 column v-wind mass flux ";
    }
    so2cmass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "so2 column mass density ";
    }
    ssscat25 {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "sea salt aerosol optical depth due to scattering from particulate matter < 2.5 microns (pm2.5) ";
    }
    nifluxu {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "nitrate column u-wind mass flux ";
    }
    nismass25 {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "nitrate surface mass concentration of particulate matter < 2.5 microns (pm2.5) ";
    }
    niangstr {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "nitrate angstrom parameter [470-870 nm] ";
    }
    dustexttau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "dust stratospheric aerosol optical thickness ";
    }
    duextt25 {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "dust aerosol optical depth from particulate matter < 2.5 microns (pm2.5) ";
    }
    sustexttau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "so4 stratospheric aerosol optical thickness ";
    }
    suangstr {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "so4 angstrom parameter [470-870 nm] ";
    }
    bcsmass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "bc aerosol surface mass concentration ";
    }
    totexttau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "total aerosol optical depth at 550 nm ";
    }
    niexttfm {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "nitrate aerosol optical depth from particulate matter < 1 micron (pm1.0) ";
    }
    ssfluxv {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "sea salt column v-wind mass flux ";
    }
    totscatau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "total aerosol optical depth at 550 nm due to scattering ";
    }
    sustscatau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "so4 stratospheric aerosol optical depth due to scattering ";
    }
    ssextt25 {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "sea salt aerosol optical depth from particulate matter < 2.5 microns (pm2.5) ";
    }
    ssscatau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "sea salt aerosol optical depth due to scattering ";
    }
    dufluxu {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "dust column u-wind mass flux ";
    }
    occmass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "oc aerosol column mass density ";
    }
    dufluxv {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "dust column v-wind mass flux ";
    }
    brexttau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "br aerosol optical depth ";
    }
    totstexttau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "total stratospheric aerosol optical thickness at 550 nm ";
    }
    so4cmass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "so4 column mass density ";
    }
    hno3smass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "nitric acid surface mass concentration ";
    }
    ssexttau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "sea salt aerosol optical depth ";
    }
    ocstexttau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "oc stratospheric aerosol optical thickness ";
    }
    bccmass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "bc aerosol column mass density ";
    }
    sssmass25 {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "sea salt surface mass concentration of particulate matter < 2.5 microns (pm2.5) ";
    }
    brangstr {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "br aerosol angstrom parameter [470-870 nm] ";
    }
    nh3cmass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "ammonia column mass density ";
    }
    ocstscatau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "oc stratospheric aerosol optical thickness due to scattering ";
    }
    sscmass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "sea salt column mass density ";
    }
    pm25 {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "total reconstructed dry particulate matter < 2.5 microns (pm2.5) ";
    }
    dmscmass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "dms column mass density ";
    }
    nh4cmass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "ammonium column mass density ";
    }
    bcexttau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "bc aerosol optical depth ";
    }
    brscatau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "br aerosol optical depth due to scattering ";
    }
    dustscatau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "dust stratospheric aerosol optical thickness due to scattering ";
    }
    hno3cmass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "nitric acid column mass density ";
    }
    dmssmass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "dms surface mass concentration ";
    }
    ocfluxv {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "oc aerosol column v-wind mass flux ";
    }
    bcfluxv {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "bc aerosol column v-wind mass flux ";
    }
    pm {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "total reconstructed dry particulate matter ";
    }
    ssstscatau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "sea salt stratospheric aerosol optical thickness due to scattering ";
    }
    duscatau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "dust aerosol optical depth due to scattering ";
    }
    niscatfm {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "nitrate aerosol optical depth due to scattering from particulate matter < 1 micron (pm1.0) ";
    }
    sssmass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "sea salt surface mass concentration ";
    }
    ssfluxu {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "sea salt column u-wind mass flux ";
    }
    nh4smass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "ammonium surface mass concentration ";
    }
    brstscatau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "br stratospheric aerosol optical thickness due to scattering ";
    }
    nh3smass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "ammonia surface mass concentration ";
    }
    brfluxu {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "br aerosol column u-wind mass flux ";
    }
    ocscatau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "oc aerosol optical depth due to scattering ";
    }
    brfluxv {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "br aerosol column v-wind mass flux ";
    }
    niscatau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "nitrate aerosol optical depth due to scattering ";
    }
    ocsmass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "oc aerosol surface mass concentration ";
    }
    so2smass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "so2 surface mass concentration ";
    }
    nifluxv {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "nitrate column v-wind mass flux ";
    }
    totstscatau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "total stratospheric aerosol optical thickness at 550 nm due to scattering ";
    }
    nicmass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "nitrate column mass density ";
    }
    suexttau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "so4 aerosol optical depth ";
    }
    brsmass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "br aerosol surface mass concentration ";
    }
    bcangstr {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "bc aerosol angstrom parameter [470-870 nm] ";
    }
    duexttau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "dust aerosol optical depth ";
    }
    brcmass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "br aerosol column mass density ";
    }
    ducmass25 {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "dust column mass density of particulate matter < 2.5 microns (pm 2.5) ";
    }
    brstexttau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "br stratospheric aerosol optical thickness ";
    }
    ocfluxu {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "oc aerosol column u-wind mass flux ";
    }
    ssstexttau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "sea salt stratospheric aerosol optical thickness ";
    }
    dusmass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "dust surface mass concentration ";
    }
    bcfluxu {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "bc aerosol column u-wind mass flux ";
    }
    so4smass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "so4 surface mass concentration ";
    }
    totangstr {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "total aerosol angstrom parameter [470-870 nm] ";
    }
    suscatau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "so4 aerosol optical depth due to scattering ";
    }
    ocangstr {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "oc aerosol angstrom parameter [470-870 nm] ";
    }
    ssangstr {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "sea salt angstrom parameter [470-870 nm] ";
    }
    dusmass25 {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "dust surface mass concentration of particulate matter < 2.5 microns (pm 2.5) ";
    }
    nicmass25 {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "nitrate column mass density of particulate matter < 2.5 microns (pm2.5) ";
    }
    duscat25 {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "dust aerosol optical depth due to scattering from particulate matter < 2.5 microns (pm2.5) ";
    }
    nismass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "nitrate surface mass concentration ";
    }
    bcscatau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "bc aerosol optical depth due to scattering ";
    }
    taitime {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "taitime ";
    }
    ocexttau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "oc aerosol optical depth ";
    }
    niexttau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "nitrate aerosol optical depth ";
    }
    ducmass {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "dust column mass density ";
    }
    bcstexttau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "bc stratospheric aerosol optical thickness ";
    }
    bcstscatau {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "bc stratospheric aerosol optical thickness due to scattering ";
    }
    sufluxu {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "so4 column u-wind mass flux ";
    }
    sscmass25 {
        Float32 _FillValue 1.0E15;
        Float32 missing_value 1.0E15;
        String long_name "sea salt column mass density of particulate matter < 2.5 microns (pm2.5) ";
    }
}
